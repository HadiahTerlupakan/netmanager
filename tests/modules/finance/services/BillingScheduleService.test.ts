import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  addBillingScheduleJob: vi.fn(),
  removeBillingScheduleJob: vi.fn(),
}));

vi.mock("@/lib/event-bus", () => ({
  addBillingScheduleJob: mockFns.addBillingScheduleJob,
  removeBillingScheduleJob: mockFns.removeBillingScheduleJob,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { BillingScheduleService } from "@/modules/finance/services/BillingScheduleService";
import type { BillingScheduleEntity } from "@/modules/finance/domain/entities/BillingScheduleEntity";
import type { IBillingScheduleRepository } from "@/modules/finance/domain/ports/IBillingScheduleRepository";

function createSchedule(
  overrides: Partial<BillingScheduleEntity> = {},
): BillingScheduleEntity {
  return {
    id: "schedule-1",
    dedupeKey: "dedupe-1",
    jobType: "CUSTOMER_AUTO_ISOLIR",
    invoiceId: "inv-1",
    pelangganId: "cust-1",
    runAt: new Date("2026-05-12T10:00:00.000Z"),
    status: "QUEUED",
    queueJobId: null,
    payload: null,
    version: 1,
    attemptCount: 0,
    queuedAt: null,
    processingAt: null,
    completedAt: null,
    cancelledAt: null,
    failedAt: null,
    lastAttemptAt: null,
    lastError: null,
    createdAt: new Date("2026-05-12T09:00:00.000Z"),
    updatedAt: new Date("2026-05-12T09:00:00.000Z"),
    tenantId: null,
    ...overrides,
  };
}

function createRepository(
  markQueuedResult = true,
): IBillingScheduleRepository & { markQueued: ReturnType<typeof vi.fn> } {
  return {
    findById: vi.fn(),
    findByDedupeKey: vi.fn(),
    findForRehydration: vi.fn(),
    findForReconciliation: vi.fn(),
    upsert: vi.fn(),
    markQueued: vi.fn().mockResolvedValue(markQueuedResult),
    markProcessing: vi.fn(),
    markCompleted: vi.fn(),
    markFailed: vi.fn(),
    cancel: vi.fn(),
    updateStatus: vi.fn(),
  } as unknown as IBillingScheduleRepository & {
    markQueued: ReturnType<typeof vi.fn>;
  };
}

describe("BillingScheduleService.enqueuePersistedSchedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Regresi: status QUEUED dulu ditulis SETELAH enqueue. Untuk runAt lampau
  // (delay 0) worker bisa selesai lebih dulu, lalu tulisan QUEUED menimpa
  // COMPLETED dan reconciliation menjalankan ulang job yang sudah jalan.
  it("mengklaim status QUEUED sebelum job masuk queue", async () => {
    const callOrder: string[] = [];
    const repository = createRepository();
    repository.markQueued.mockImplementation(async () => {
      callOrder.push("markQueued");
      return true;
    });
    mockFns.addBillingScheduleJob.mockImplementation(async () => {
      callOrder.push("addBillingScheduleJob");
    });

    await new BillingScheduleService(repository).enqueuePersistedSchedule(
      createSchedule(),
    );

    expect(callOrder).toEqual(["markQueued", "addBillingScheduleJob"]);
  });

  // Regresi: markQueued adalah compare-and-set. Job yang sudah COMPLETED atau
  // CANCELLED tidak boleh dihidupkan lagi — CUSTOMER_AUTO_ISOLIR yang dobel
  // memutus pelanggan yang sudah membayar.
  it("tidak enqueue saat schedule sudah selesai atau dibatalkan", async () => {
    const repository = createRepository(false);

    const result = await new BillingScheduleService(
      repository,
    ).enqueuePersistedSchedule(createSchedule({ status: "COMPLETED" }));

    expect(result.claimed).toBe(false);
    expect(mockFns.addBillingScheduleJob).not.toHaveBeenCalled();
  });

  it("menyimpan job id yang sama dengan yang dikirim ke queue", async () => {
    const repository = createRepository();

    const result = await new BillingScheduleService(
      repository,
    ).enqueuePersistedSchedule(createSchedule({ version: 3 }));

    expect(repository.markQueued).toHaveBeenCalledWith(
      "schedule-1",
      expect.any(Date),
      "billing-schedule.schedule-1.v3",
    );
    expect(mockFns.addBillingScheduleJob).toHaveBeenCalledWith(
      { scheduleId: "schedule-1", version: 3 },
      { jobId: "billing-schedule.schedule-1.v3", delay: expect.any(Number) },
    );
    expect(result.claimed).toBe(true);
  });

  it("tidak memberi delay negatif untuk schedule yang sudah lewat", async () => {
    const repository = createRepository();

    const result = await new BillingScheduleService(
      repository,
    ).enqueuePersistedSchedule(
      createSchedule({ runAt: new Date("2020-01-01T00:00:00.000Z") }),
    );

    expect(result.delay).toBe(0);
  });
});

describe("BillingScheduleService.executeScheduledJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Regresi: guard lama `if (options?.version && ...)` memperlakukan versi 0
  // sebagai "tidak ada versi" sehingga job basi lolos.
  it("tidak menganggap versi 0 sebagai versi kosong", async () => {
    const repository = createRepository();
    repository.findById = vi
      .fn()
      .mockResolvedValue(createSchedule({ version: 5, status: "QUEUED" }));

    await new BillingScheduleService(repository).executeScheduledJob(
      "schedule-1",
      { version: 0 },
    );

    expect(repository.markProcessing).not.toHaveBeenCalled();
  });

  it.each([["COMPLETED"], ["CANCELLED"]] as const)(
    "melewati schedule ber-status %s",
    async (status) => {
      const repository = createRepository();
      repository.findById = vi
        .fn()
        .mockResolvedValue(createSchedule({ status }));

      await new BillingScheduleService(repository).executeScheduledJob(
        "schedule-1",
      );

      expect(repository.markProcessing).not.toHaveBeenCalled();
    },
  );
});
