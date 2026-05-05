import { OvertimeStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import type {
  CancelOvertimeAutoCheckoutScheduleInput,
  CompleteOvertimeAutoCheckoutScheduleInput,
  CompleteScheduledAutoCheckoutInput,
  UpsertOvertimeAutoCheckoutScheduleInput,
} from "../domain/ports/IOvertimeRepository";
import { OvertimeMapper } from "../mappers/OvertimeMapper";

const SCHEDULE_CONFLICT_ERROR = "OVERTIME_AUTO_CHECKOUT_CONFLICT";

/** Menangani persistence auto-checkout schedule overtime. */
export class OvertimeScheduleRepository {
  /** Ambil schedule auto-checkout berdasarkan ID. */
  async findById(id: string) {
    const record = await prisma.overtimeAutoCheckoutSchedule.findUnique({
      where: { id },
    });

    return record ? OvertimeMapper.toScheduleDomain(record) : null;
  }

  /** Ambil schedule auto-checkout berdasarkan overtime ID. */
  async findByOvertimeId(overtimeId: string) {
    const record = await prisma.overtimeAutoCheckoutSchedule.findUnique({
      where: { overtimeId },
    });

    return record ? OvertimeMapper.toScheduleDomain(record) : null;
  }

  /** Ambil schedule aktif untuk rehydration queue. */
  async findForRehydration() {
    const records = await prisma.overtimeAutoCheckoutSchedule.findMany({
      where: { scheduleStatus: "SCHEDULED" },
      orderBy: { scheduledFor: "asc" },
    });

    return records.map((record) => OvertimeMapper.toScheduleDomain(record));
  }

  /** Simpan job ID queue ke schedule overtime. */
  async attachJobId(overtimeId: string, jobId: string) {
    const record = await prisma.overtimeAutoCheckoutSchedule.update({
      where: { overtimeId },
      data: { jobId },
    });

    return OvertimeMapper.toScheduleDomain(record);
  }

  /** Buat atau ganti schedule auto-checkout. */
  async upsert(input: UpsertOvertimeAutoCheckoutScheduleInput) {
    const nextVersion = await getNextScheduleVersion(input.overtimeId);
    const record = await prisma.overtimeAutoCheckoutSchedule.upsert({
      where: { overtimeId: input.overtimeId },
      create: {
        overtimeId: input.overtimeId,
        scheduledFor: input.scheduledFor,
        jobId: input.jobId ?? null,
        version: nextVersion,
        scheduleStatus: "SCHEDULED",
      },
      update: {
        scheduledFor: input.scheduledFor,
        jobId: input.jobId ?? null,
        version: nextVersion,
        scheduleStatus: "SCHEDULED",
        cancelledAt: null,
        executedAt: null,
        lastError: null,
      },
    });

    return OvertimeMapper.toScheduleDomain(record);
  }

  /** Batalkan schedule auto-checkout yang masih aktif. */
  async cancel(input: CancelOvertimeAutoCheckoutScheduleInput) {
    return prisma.overtimeAutoCheckoutSchedule.updateMany({
      where: { overtimeId: input.overtimeId, scheduleStatus: "SCHEDULED" },
      data: {
        scheduleStatus: "CANCELLED",
        cancelledAt: input.cancelledAt,
        jobId: null,
      },
    });
  }

  /** Tandai schedule selesai atau gagal. */
  async complete(input: CompleteOvertimeAutoCheckoutScheduleInput) {
    const record = await prisma.overtimeAutoCheckoutSchedule.update({
      where: { overtimeId: input.overtimeId },
      data: {
        scheduleStatus: input.scheduleStatus,
        executedAt: input.executedAt,
        lastError: input.lastError,
        jobId: null,
      },
    });

    return OvertimeMapper.toScheduleDomain(record);
  }

  /** Selesaikan overtime dan schedule secara atomik. */
  async completeScheduledAutoCheckout(
    input: CompleteScheduledAutoCheckoutInput,
  ): Promise<boolean> {
    try {
      return await prisma.$transaction(async (transaction) => {
        const scheduleResult =
          await transaction.overtimeAutoCheckoutSchedule.updateMany({
            where: {
              id: input.scheduleId,
              overtimeId: input.overtimeId,
              version: input.version,
              scheduleStatus: "SCHEDULED",
            },
            data: {
              scheduleStatus: "COMPLETED",
              executedAt: input.executedAt,
              lastError: null,
              jobId: null,
            },
          });

        if (scheduleResult.count !== 1) {
          return false;
        }

        await completeInProgressOvertime(transaction, input);
        return true;
      });
    } catch (error) {
      if (isScheduleConflictError(error)) {
        return false;
      }

      throw error;
    }
  }
}

async function getNextScheduleVersion(overtimeId: string): Promise<number> {
  const current = await prisma.overtimeAutoCheckoutSchedule.findUnique({
    where: { overtimeId },
    select: { version: true },
  });

  return (current?.version ?? 0) + 1;
}

async function completeInProgressOvertime(
  transaction: Prisma.TransactionClient,
  input: CompleteScheduledAutoCheckoutInput,
): Promise<void> {
  const overtimeResult = await transaction.overtime.updateMany({
    where: { id: input.overtimeId, status: OvertimeStatus.IN_PROGRESS },
    data: {
      status: OvertimeStatus.COMPLETED,
      endTime: input.endTime,
      duration: input.duration,
      updatedAt: new Date(),
    },
  });

  if (overtimeResult.count === 1) {
    return;
  }

  throw new Error(SCHEDULE_CONFLICT_ERROR);
}

function isScheduleConflictError(error: unknown): boolean {
  return error instanceof Error && error.message === SCHEDULE_CONFLICT_ERROR;
}
