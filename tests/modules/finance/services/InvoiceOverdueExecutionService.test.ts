import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  findRawById: vi.fn(),
  markOverdueIfEligible: vi.fn(),
  logActivity: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/modules/finance/repositories/InvoiceRepository", () => ({
  InvoiceRepository: class MockInvoiceRepository {
    findRawById = mockFns.findRawById;
    markOverdueIfEligible = mockFns.markOverdueIfEligible;
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    logActivity: mockFns.logActivity,
    info: mockFns.info,
    warn: mockFns.warn,
  },
}));

import { InvoiceOverdueExecutionService } from "@/modules/finance/services/InvoiceOverdueExecutionService";

describe("InvoiceOverdueExecutionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.logActivity.mockResolvedValue(undefined);
    mockFns.findRawById.mockResolvedValue({
      id: "inv-1",
      invoiceNumber: "INV-001",
      status: "SENT",
    });
  });

  it("mengembalikan false secara idempotent saat invoice tidak berubah", async () => {
    mockFns.markOverdueIfEligible.mockResolvedValue(false);

    const result = await new InvoiceOverdueExecutionService().execute(
      "inv-1",
      new Date("2026-05-31T00:00:00.000Z"),
    );

    expect(result).toBe(false);
    expect(mockFns.markOverdueIfEligible).toHaveBeenCalledWith(
      "inv-1",
      new Date("2026-05-31T00:00:00.000Z"),
    );
    expect(mockFns.logActivity).not.toHaveBeenCalled();
  });

  it("menandai overdue dan mencatat activity saat transisi terjadi", async () => {
    mockFns.markOverdueIfEligible.mockResolvedValue(true);

    const result = await new InvoiceOverdueExecutionService().execute(
      "inv-1",
      new Date("2026-05-31T00:00:00.000Z"),
    );

    expect(result).toBe(true);
    expect(mockFns.logActivity).toHaveBeenCalledWith({
      action: "UPDATE",
      subject: "Invoice (Auto Overdue)",
      details: {
        id: "inv-1",
        invoiceNumber: "INV-001",
        previousStatus: "SENT",
        nextStatus: "OVERDUE",
      },
    });
  });
});
