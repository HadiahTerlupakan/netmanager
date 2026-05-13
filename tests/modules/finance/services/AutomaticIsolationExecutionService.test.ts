import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  findWithPayment: vi.fn(),
  bridgeFindById: vi.fn(),
  getAutoIsolationSettings: vi.fn(),
  updateStatusPelanggan: vi.fn(),
  logActivity: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/modules/finance/repositories/InvoiceRepository", () => ({
  InvoiceRepository: class MockInvoiceRepository {
    findWithPayment = mockFns.findWithPayment;
  },
}));

vi.mock("@/modules/pelanggan", () => ({
  getPelangganService: () => ({
    updateStatusPelanggan: mockFns.updateStatusPelanggan,
  }),
  PelangganBillingBridgeService: class MockPelangganBillingBridgeService {
    findById = mockFns.bridgeFindById;
  },
}));

vi.mock("@/modules/settings", () => ({
  getAutoIsolationSettings: mockFns.getAutoIsolationSettings,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    logActivity: mockFns.logActivity,
    info: mockFns.info,
    warn: mockFns.warn,
  },
}));

import { AutomaticIsolationExecutionService } from "@/modules/finance/services/AutomaticIsolationExecutionService";

describe("AutomaticIsolationExecutionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.getAutoIsolationSettings.mockResolvedValue({
      enabled: true,
      toleranceDays: 3,
    });
    mockFns.logActivity.mockResolvedValue(undefined);
  });

  it("mengembalikan false secara idempotent saat pelanggan tidak lagi eligible", async () => {
    mockFns.findWithPayment.mockResolvedValue({
      id: "inv-1",
      invoiceNumber: "INV-001",
      status: "OVERDUE",
      dueDate: new Date("2026-05-01T00:00:00.000Z"),
      paidAmount: 0n,
      totalAmount: 100000n,
    });
    mockFns.bridgeFindById.mockResolvedValue({
      id: "cust-1",
      userId: "user-1",
      nama: "Pelanggan A",
      status: "ISOLIR",
      autoIsolir: true,
    });

    const result = await new AutomaticIsolationExecutionService().execute(
      { invoiceId: "inv-1", pelangganId: "cust-1" },
      new Date("2026-05-31T00:00:00.000Z"),
    );

    expect(result).toBe(false);
    expect(mockFns.updateStatusPelanggan).not.toHaveBeenCalled();
    expect(mockFns.logActivity).not.toHaveBeenCalled();
  });

  it("mengisolir pelanggan aktif saat invoice masih eligible", async () => {
    mockFns.findWithPayment.mockResolvedValue({
      id: "inv-1",
      invoiceNumber: "INV-001",
      status: "OVERDUE",
      dueDate: new Date("2026-05-01T00:00:00.000Z"),
      paidAmount: 0n,
      totalAmount: 100000n,
    });
    mockFns.bridgeFindById.mockResolvedValue({
      id: "cust-1",
      userId: "user-1",
      nama: "Pelanggan A",
      status: "AKTIF",
      autoIsolir: true,
    });

    const result = await new AutomaticIsolationExecutionService().execute(
      { invoiceId: "inv-1", pelangganId: "cust-1" },
      new Date("2026-05-31T00:00:00.000Z"),
    );

    expect(result).toBe(true);
    expect(mockFns.updateStatusPelanggan).toHaveBeenCalledWith(
      "cust-1",
      "ISOLIR",
    );
    // Notifikasi sekarang via event CUSTOMER_ISOLATED (handler customer-notification.handler)
    // bukan direct call — tidak perlu assert notifyCustomerFinanceNotification
    expect(mockFns.logActivity).toHaveBeenCalledWith({
      action: "UPDATE",
      subject: "Pelanggan (Auto Isolir)",
      details: {
        id: "cust-1",
        name: "Pelanggan A",
        invoiceId: "inv-1",
        invoiceNumber: "INV-001",
        nextStatus: "ISOLIR",
      },
    });
  });
});
