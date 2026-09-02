import type {
  BillingScheduleEntity,
  BillingScheduleJobType,
  BillingScheduleStatus,
} from "../entities/BillingScheduleEntity";

export interface UpsertBillingScheduleInput {
  dedupeKey: string;
  jobType: BillingScheduleJobType;
  invoiceId?: string | null;
  pelangganId?: string | null;
  runAt: Date;
  payload?: Record<string, unknown> | null;
  tenantId?: string | null;
}

export interface CancelBillingScheduleInput {
  dedupeKey: string;
  cancelledAt: Date;
}

export interface CompleteBillingScheduleInput {
  scheduleId: string;
  completedAt: Date;
}

export interface FailBillingScheduleInput {
  scheduleId: string;
  failedAt: Date;
  lastError: string;
}

export interface BatchOperationResult {
  count: number;
}

/** Port persistence untuk schedule job billing durable. */
export interface IBillingScheduleRepository {
  findById(id: string): Promise<BillingScheduleEntity | null>;
  findByDedupeKey(dedupeKey: string): Promise<BillingScheduleEntity | null>;
  findForRehydration(): Promise<BillingScheduleEntity[]>;
  findForReconciliation(
    now: Date,
    staleProcessingBefore: Date,
  ): Promise<BillingScheduleEntity[]>;
  upsert(input: UpsertBillingScheduleInput): Promise<BillingScheduleEntity>;
  /**
   * Tandai QUEUED sekaligus simpan job id dalam satu tulisan.
   * Transisi bersifat compare-and-set: schedule yang sudah COMPLETED atau
   * CANCELLED tidak boleh dihidupkan kembali.
   * @returns true bila transisi benar-benar terjadi.
   */
  markQueued(
    scheduleId: string,
    queuedAt: Date,
    queueJobId: string,
  ): Promise<boolean>;
  markProcessing(
    scheduleId: string,
    processingAt: Date,
  ): Promise<BillingScheduleEntity>;
  markCompleted(
    input: CompleteBillingScheduleInput,
  ): Promise<BillingScheduleEntity>;
  markFailed(input: FailBillingScheduleInput): Promise<BillingScheduleEntity>;
  cancel(input: CancelBillingScheduleInput): Promise<BatchOperationResult>;
  updateStatus(
    scheduleId: string,
    status: BillingScheduleStatus,
  ): Promise<BillingScheduleEntity>;
}
