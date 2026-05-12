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
  findForRehydration(now: Date): Promise<BillingScheduleEntity[]>;
  findForReconciliation(
    now: Date,
    staleProcessingBefore: Date,
  ): Promise<BillingScheduleEntity[]>;
  upsert(input: UpsertBillingScheduleInput): Promise<BillingScheduleEntity>;
  attachQueueJobId(
    scheduleId: string,
    queueJobId: string,
  ): Promise<BillingScheduleEntity>;
  markQueued(
    scheduleId: string,
    queuedAt: Date,
  ): Promise<BillingScheduleEntity>;
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
