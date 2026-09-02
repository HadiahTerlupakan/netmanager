import { prismaBilling } from "@/lib/prisma-billing";
import { Prisma } from "@prisma/client-billing";
import type { BillingScheduleStatus } from "../domain/entities/BillingScheduleEntity";
import type {
  BatchOperationResult,
  CancelBillingScheduleInput,
  CompleteBillingScheduleInput,
  FailBillingScheduleInput,
  IBillingScheduleRepository,
  UpsertBillingScheduleInput,
} from "../domain/ports/IBillingScheduleRepository";
import { BillingScheduleMapper } from "../mappers/BillingScheduleMapper";

/** Repository persistence untuk billing schedule durable. */
export class BillingScheduleRepository implements IBillingScheduleRepository {
  async findById(id: string) {
    const record = await prismaBilling.billingSchedule.findUnique({
      where: { id },
    });

    return record ? BillingScheduleMapper.toDomain(record) : null;
  }

  async findByDedupeKey(dedupeKey: string) {
    const record = await prismaBilling.billingSchedule.findUnique({
      where: { dedupeKey },
    });

    return record ? BillingScheduleMapper.toDomain(record) : null;
  }

  async findForRehydration() {
    const records = await prismaBilling.billingSchedule.findMany({
      where: {
        status: { in: ["PENDING", "QUEUED"] },
      },
      orderBy: { runAt: "asc" },
    });

    return records.map((record) => BillingScheduleMapper.toDomain(record));
  }

  async findForReconciliation(now: Date, staleProcessingBefore: Date) {
    const records = await prismaBilling.billingSchedule.findMany({
      where: {
        OR: [
          {
            status: { in: ["PENDING", "QUEUED", "FAILED"] },
            runAt: { lte: now },
          },
          {
            status: "PROCESSING",
            processingAt: { lte: staleProcessingBefore },
          },
        ],
      },
      orderBy: [{ runAt: "asc" }, { updatedAt: "asc" }],
    });

    return records.map((record) => BillingScheduleMapper.toDomain(record));
  }

  /**
   * Upsert schedule dan naikkan versi secara atomik.
   * Version dipakai untuk membuang job queue yang sudah basi, jadi kenaikannya
   * harus lewat `increment` — read-modify-write akan menghasilkan versi kembar
   * bila dua reschedule terjadi bersamaan.
   */
  async upsert(input: UpsertBillingScheduleInput) {
    const record = await prismaBilling.billingSchedule.upsert({
      where: { dedupeKey: input.dedupeKey },
      create: {
        dedupeKey: input.dedupeKey,
        jobType: input.jobType,
        invoiceId: input.invoiceId ?? null,
        pelangganId: input.pelangganId ?? null,
        runAt: input.runAt,
        payload: toPrismaJson(input.payload),
        queueJobId: null,
        status: "PENDING",
        tenantId: input.tenantId ?? null,
      },
      update: {
        jobType: input.jobType,
        invoiceId: input.invoiceId ?? null,
        pelangganId: input.pelangganId ?? null,
        runAt: input.runAt,
        payload: toPrismaJson(input.payload),
        queueJobId: null,
        status: "PENDING",
        version: { increment: 1 },
        queuedAt: null,
        processingAt: null,
        completedAt: null,
        cancelledAt: null,
        failedAt: null,
        lastAttemptAt: null,
        lastError: null,
        tenantId: input.tenantId ?? null,
      },
    });

    return BillingScheduleMapper.toDomain(record);
  }

  /**
   * Compare-and-set ke QUEUED. Baris yang sudah COMPLETED atau CANCELLED
   * sengaja tidak ikut ter-update: reconciliation membaca baris pada T lalu
   * menulis pada T+delta, dan tanpa syarat status ini worker yang menyelesaikan
   * job di sela itu akan tertimpa kembali ke QUEUED lalu dieksekusi dua kali.
   */
  async markQueued(scheduleId: string, queuedAt: Date, queueJobId: string) {
    const result = await prismaBilling.billingSchedule.updateMany({
      where: {
        id: scheduleId,
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      data: {
        status: "QUEUED",
        queuedAt,
        queueJobId,
      },
    });

    return result.count > 0;
  }

  async markProcessing(scheduleId: string, processingAt: Date) {
    const record = await prismaBilling.billingSchedule.update({
      where: { id: scheduleId },
      data: {
        status: "PROCESSING",
        processingAt,
        attemptCount: { increment: 1 },
        lastAttemptAt: processingAt,
      },
    });

    return BillingScheduleMapper.toDomain(record);
  }

  async markCompleted(input: CompleteBillingScheduleInput) {
    const record = await prismaBilling.billingSchedule.update({
      where: { id: input.scheduleId },
      data: {
        status: "COMPLETED",
        completedAt: input.completedAt,
        queueJobId: null,
        lastError: null,
      },
    });

    return BillingScheduleMapper.toDomain(record);
  }

  async markFailed(input: FailBillingScheduleInput) {
    const record = await prismaBilling.billingSchedule.update({
      where: { id: input.scheduleId },
      data: {
        status: "FAILED",
        failedAt: input.failedAt,
        lastError: input.lastError,
        queueJobId: null,
      },
    });

    return BillingScheduleMapper.toDomain(record);
  }

  async cancel(
    input: CancelBillingScheduleInput,
  ): Promise<BatchOperationResult> {
    return prismaBilling.billingSchedule.updateMany({
      where: {
        dedupeKey: input.dedupeKey,
        status: { in: ["PENDING", "QUEUED", "FAILED"] },
      },
      data: {
        status: "CANCELLED",
        cancelledAt: input.cancelledAt,
        queueJobId: null,
      },
    });
  }

  async updateStatus(scheduleId: string, status: BillingScheduleStatus) {
    const record = await prismaBilling.billingSchedule.update({
      where: { id: scheduleId },
      data: { status },
    });

    return BillingScheduleMapper.toDomain(record);
  }
}

function toPrismaJson(
  value?: Record<string, unknown> | null,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (!value) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonObject;
}
