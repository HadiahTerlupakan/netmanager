import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  schedule: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock("@/modules/finance/services/BillingScheduleService", () => ({
  BillingScheduleService: class MockBillingScheduleService {
    schedule = mockFns.schedule;
    cancel = mockFns.cancel;
  },
}));

import {
  buildInvoiceOverdueDedupeKey,
  InvoiceOverdueSchedulerService,
} from "@/modules/finance/services/InvoiceOverdueSchedulerService";

describe("InvoiceOverdueSchedulerService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.schedule.mockResolvedValue(undefined);
    mockFns.cancel.mockResolvedValue(undefined);
  });

  it("menjadwalkan invoice eligible dengan dedupe key overdue", async () => {
    const service = new InvoiceOverdueSchedulerService();
    const dueDate = new Date("2026-05-31T00:00:00.000Z");

    await service.syncForInvoice({
      id: "inv-1",
      pelangganId: "cust-1",
      dueDate,
      status: "SENT",
    });

    expect(mockFns.schedule).toHaveBeenCalledWith({
      dedupeKey: buildInvoiceOverdueDedupeKey("inv-1"),
      jobType: "INVOICE_MARK_OVERDUE",
      invoiceId: "inv-1",
      pelangganId: "cust-1",
      runAt: dueDate,
    });
    expect(mockFns.cancel).not.toHaveBeenCalled();
  });

  it("membatalkan schedule invoice yang tidak lagi eligible", async () => {
    const service = new InvoiceOverdueSchedulerService();

    await service.syncForInvoice({
      id: "inv-1",
      pelangganId: "cust-1",
      dueDate: new Date("2026-05-31T00:00:00.000Z"),
      status: "PAID",
    });

    expect(mockFns.cancel).toHaveBeenCalledWith(
      buildInvoiceOverdueDedupeKey("inv-1"),
    );
    expect(mockFns.schedule).not.toHaveBeenCalled();
  });
});
