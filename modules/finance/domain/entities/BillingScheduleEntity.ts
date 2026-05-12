export type BillingScheduleJobType =
  | "INVOICE_MARK_OVERDUE"
  | "CUSTOMER_AUTO_ISOLIR";

export type BillingScheduleStatus =
  | "PENDING"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED";

/** Entity domain untuk schedule billing durable. */
export interface BillingScheduleEntity {
  id: string;
  dedupeKey: string;
  jobType: BillingScheduleJobType;
  invoiceId: string | null;
  pelangganId: string | null;
  runAt: Date;
  status: BillingScheduleStatus;
  queueJobId: string | null;
  payload: Record<string, unknown> | null;
  version: number;
  attemptCount: number;
  queuedAt: Date | null;
  processingAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  failedAt: Date | null;
  lastAttemptAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  tenantId: string | null;
}
