import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockFns = vi.hoisted(() => ({
  acquireCronLock: vi.fn(),
  reconcile: vi.fn(),
}));

vi.mock("@/lib/cron-lock", () => ({
  acquireCronLock: mockFns.acquireCronLock,
  CRON_LOCK_UNAVAILABLE_MESSAGE:
    "Layanan cron sementara tidak tersedia. Coba lagi beberapa saat.",
}));

vi.mock(
  "@/modules/finance/services/BillingScheduleReconciliationService",
  () => ({
    BillingScheduleReconciliationService: class MockBillingScheduleReconciliationService {
      reconcile = mockFns.reconcile;
    },
  }),
);

import { GET } from "@/app/api/cron/reconcile-billing-schedules/route";

describe("reconcile-billing-schedules cron route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
  });

  it("rejects unauthorized request", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/cron/reconcile-billing-schedules"),
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.success).toBe(false);
    expect(mockFns.acquireCronLock).not.toHaveBeenCalled();
  });

  it("returns a skip response when reconciliation lock is already held", async () => {
    mockFns.acquireCronLock.mockResolvedValue("locked");

    const response = await GET(
      new NextRequest("http://localhost/api/cron/reconcile-billing-schedules", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data.skipped).toBe(true);
    expect(json.data.reason).toBe("Lock already held");
    expect(mockFns.acquireCronLock).toHaveBeenCalledWith(
      "route:billingScheduleReconciliation",
      55,
    );
    expect(mockFns.reconcile).not.toHaveBeenCalled();
  });

  it("runs reconciliation when lock is acquired", async () => {
    mockFns.acquireCronLock.mockResolvedValue("acquired");
    mockFns.reconcile.mockResolvedValue({
      scanned: 2,
      requeued: 2,
      pendingRequeued: 1,
      queuedRequeued: 1,
      failedRetried: 0,
      staleProcessingRecovered: 0,
      errors: 0,
    });

    const response = await GET(
      new NextRequest("http://localhost/api/cron/reconcile-billing-schedules", {
        headers: { authorization: "Bearer cron-secret" },
      }),
    );
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(json.data.scanned).toBe(2);
    expect(mockFns.reconcile).toHaveBeenCalledOnce();
  });
});
