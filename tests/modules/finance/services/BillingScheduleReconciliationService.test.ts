import { beforeEach, describe, expect, it, vi } from "vitest";
import { BillingScheduleReconciliationService } from "@/modules/finance/services/BillingScheduleReconciliationService";
import type { BillingScheduleEntity } from "@/modules/finance/domain/entities/BillingScheduleEntity";
import type { IBillingScheduleRepository } from "@/modules/finance/domain/ports/IBillingScheduleRepository";
import type { BillingScheduleService } from "@/modules/finance/services/BillingScheduleService";

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

function createSchedule(
  overrides: Partial<BillingScheduleEntity>,
): BillingScheduleEntity {
  return {
    id: overrides.id ?? "schedule-1",
    dedupeKey: overrides.dedupeKey ?? `dedupe-${overrides.id ?? "schedule-1"}`,
    jobType: overrides.jobType ?? "INVOICE_MARK_OVERDUE",
    invoiceId: overrides.invoiceId ?? "inv-1",
    pelangganId: overrides.pelangganId ?? "cust-1",
    runAt: overrides.runAt ?? new Date("2026-05-12T10:00:00.000Z"),
    status: overrides.status ?? "PENDING",
    queueJobId: overrides.queueJobId ?? null,
    payload: overrides.payload ?? null,
    version: overrides.version ?? 1,
    attemptCount: overrides.attemptCount ?? 0,
    queuedAt: overrides.queuedAt ?? null,
    processingAt: overrides.processingAt ?? null,
    completedAt: overrides.completedAt ?? null,
    cancelledAt: overrides.cancelledAt ?? null,
    failedAt: overrides.failedAt ?? null,
    lastAttemptAt: overrides.lastAttemptAt ?? null,
    lastError: overrides.lastError ?? null,
    createdAt: overrides.createdAt ?? new Date("2026-05-12T09:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-05-12T09:00:00.000Z"),
    tenantId: overrides.tenantId ?? null,
  };
}

describe("BillingScheduleReconciliationService", () => {
  const now = new Date("2026-05-12T10:05:00.000Z");

  let repository: IBillingScheduleRepository;
  let billingScheduleService: BillingScheduleService;

  const findForReconciliation = vi.fn();
  const updateStatus = vi.fn();
  const enqueuePersistedSchedule = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    repository = {
      findById: vi.fn(),
      findByDedupeKey: vi.fn(),
      findForRehydration: vi.fn(),
      findForReconciliation,
      upsert: vi.fn(),
      markQueued: vi.fn(),
      markProcessing: vi.fn(),
      markCompleted: vi.fn(),
      markFailed: vi.fn(),
      cancel: vi.fn(),
      updateStatus,
    } as unknown as IBillingScheduleRepository;

    billingScheduleService = {
      enqueuePersistedSchedule,
    } as unknown as BillingScheduleService;
  });

  it("requeues pending, queued, failed, and stale processing schedules", async () => {
    const pending = createSchedule({
      id: "schedule-pending",
      status: "PENDING",
    });
    const queued = createSchedule({ id: "schedule-queued", status: "QUEUED" });
    const failed = createSchedule({ id: "schedule-failed", status: "FAILED" });
    const processing = createSchedule({
      id: "schedule-processing",
      status: "PROCESSING",
      processingAt: new Date("2026-05-12T09:30:00.000Z"),
    });
    const recovered = createSchedule({
      ...processing,
      status: "PENDING",
      queueJobId: null,
    });

    findForReconciliation.mockResolvedValue([
      pending,
      queued,
      failed,
      processing,
    ]);
    updateStatus.mockResolvedValue(recovered);

    const service = new BillingScheduleReconciliationService(
      repository,
      billingScheduleService,
    );

    const result = await service.reconcile({
      now,
      staleProcessingMinutes: 15,
    });

    expect(findForReconciliation).toHaveBeenCalledWith(
      now,
      new Date("2026-05-12T09:50:00.000Z"),
    );
    expect(updateStatus).toHaveBeenCalledWith("schedule-processing", "PENDING");
    expect(enqueuePersistedSchedule).toHaveBeenCalledTimes(4);
    expect(enqueuePersistedSchedule).toHaveBeenNthCalledWith(1, pending, now);
    expect(enqueuePersistedSchedule).toHaveBeenNthCalledWith(2, queued, now);
    expect(enqueuePersistedSchedule).toHaveBeenNthCalledWith(3, failed, now);
    expect(enqueuePersistedSchedule).toHaveBeenNthCalledWith(4, recovered, now);
    expect(result).toEqual({
      scanned: 4,
      requeued: 4,
      pendingRequeued: 1,
      queuedRequeued: 1,
      failedRetried: 1,
      staleProcessingRecovered: 1,
      errors: 0,
    });
  });

  it("continues reconciling when one schedule fails to enqueue", async () => {
    const pending = createSchedule({
      id: "schedule-pending",
      status: "PENDING",
    });
    const failed = createSchedule({ id: "schedule-failed", status: "FAILED" });

    findForReconciliation.mockResolvedValue([pending, failed]);
    enqueuePersistedSchedule
      .mockRejectedValueOnce(new Error("queue unavailable"))
      .mockResolvedValueOnce({
        jobId: "billing-schedule.schedule-failed.v1",
        delay: 0,
      });

    const service = new BillingScheduleReconciliationService(
      repository,
      billingScheduleService,
    );

    const result = await service.reconcile({ now });

    expect(result).toEqual({
      scanned: 2,
      requeued: 1,
      pendingRequeued: 0,
      queuedRequeued: 0,
      failedRetried: 1,
      staleProcessingRecovered: 0,
      errors: 1,
    });
  });
});
