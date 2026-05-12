import type { BillingSchedule } from "@prisma/client-billing";
import type { BillingScheduleEntity } from "../domain/entities/BillingScheduleEntity";

/** Mapper record Prisma billing schedule ke entity domain. */
export class BillingScheduleMapper {
  static toDomain(record: BillingSchedule): BillingScheduleEntity {
    return {
      id: record.id,
      dedupeKey: record.dedupeKey,
      jobType: record.jobType,
      invoiceId: record.invoiceId,
      pelangganId: record.pelangganId,
      runAt: record.runAt,
      status: record.status,
      queueJobId: record.queueJobId,
      payload: isRecord(record.payload) ? record.payload : null,
      version: record.version,
      attemptCount: record.attemptCount,
      queuedAt: record.queuedAt,
      processingAt: record.processingAt,
      completedAt: record.completedAt,
      cancelledAt: record.cancelledAt,
      failedAt: record.failedAt,
      lastAttemptAt: record.lastAttemptAt,
      lastError: record.lastError,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      tenantId: record.tenantId,
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
