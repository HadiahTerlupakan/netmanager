import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  findInvoice: vi.fn(),
  countUnpaidByPelangganId: vi.fn(),
  findOverdueInvoices: vi.fn(),
  voidInvoiceTransaction: vi.fn(),
  bridgeFindById: vi.fn(),
  bridgeUpdateJatuhTempo: vi.fn(),
  bridgeUpdateStatus: vi.fn(),
  bridgeUpdate: vi.fn(),
  findSetting: vi.fn(),
  updateStatusPelanggan: vi.fn(),
  handleStatusChange: vi.fn(),
  notifyCustomerFinanceNotification: vi.fn(),
  logActivity: vi.fn(),
  onInvoicePaid: vi.fn(),
  onIsolated: vi.fn(),
  reconcile: vi.fn(),
  closeAbandonedManualTransfers: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/modules/finance/repositories/InvoiceRepository", () => ({
  InvoiceRepository: class MockInvoiceRepository {
    findUnique = mockFns.findInvoice;
    countUnpaidByPelangganId = mockFns.countUnpaidByPelangganId;
    findOverdueInvoices = mockFns.findOverdueInvoices;
    voidInvoiceTransaction = mockFns.voidInvoiceTransaction;
  },
}));

vi.mock("@/modules/pelanggan/services/PelangganBillingBridgeService", () => ({
  PelangganBillingBridgeService: class MockPelangganBillingBridgeService {
    findById = mockFns.bridgeFindById;
    updateJatuhTempo = mockFns.bridgeUpdateJatuhTempo;
    updateStatus = mockFns.bridgeUpdateStatus;
    update = mockFns.bridgeUpdate;
  },
}));

vi.mock("@/modules/pelanggan", () => ({
  getPelangganService: () => ({
    updateStatusPelanggan: mockFns.updateStatusPelanggan,
  }),
  PelangganBillingBridgeService: class MockPelangganBillingBridgeService {
    findById = mockFns.bridgeFindById;
    updateJatuhTempo = mockFns.bridgeUpdateJatuhTempo;
    updateStatus = mockFns.bridgeUpdateStatus;
    update = mockFns.bridgeUpdate;
  },
}));

vi.mock("@/modules/attendance", () => ({
  AttendanceSettingsService: class MockAttendanceSettingsService {
    findByKey = mockFns.findSetting;
  },
}));

vi.mock("@/modules/network", () => ({
  RadiusSyncService: class MockRadiusSyncService {
    handleStatusChange = mockFns.handleStatusChange;
  },
}));

vi.mock("@/modules/finance/utils/customerFinanceNotifications", () => ({
  notifyCustomerFinanceNotification: mockFns.notifyCustomerFinanceNotification,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    logActivity: mockFns.logActivity,
    error: mockFns.logError,
  },
}));

vi.mock("@/modules/finance/services/abandoned-manual-transfer", () => ({
  closeAbandonedManualTransfers: mockFns.closeAbandonedManualTransfers,
}));

vi.mock("@/modules/finance/services/customer-checkout-lock", () => ({
  runAdminActionUnderCustomerCheckoutLock: (
    _pelangganId: string,
    _reason: string,
    task: () => Promise<unknown>,
  ) => task(),
}));

vi.mock("@/modules/events", () => ({
  BillingEventDispatcher: {
    onInvoicePaid: mockFns.onInvoicePaid,
  },
  CustomerEventDispatcher: {
    onIsolated: mockFns.onIsolated,
  },
}));

vi.mock(
  "@/modules/finance/services/BillingScheduleReconciliationService",
  () => ({
    BillingScheduleReconciliationService: class MockBillingScheduleReconciliationService {
      reconcile = mockFns.reconcile;
    },
  }),
);

import { AutomaticBillingService } from "@/modules/finance/services/AutomaticBillingService";
import { AutomaticIsolationService } from "@/modules/finance/services/AutomaticIsolationService";
import { VoidInvoiceService } from "@/modules/finance/services/VoidInvoiceService";

describe("finance customer status sync delegation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFns.countUnpaidByPelangganId.mockResolvedValue(0);
    mockFns.bridgeUpdateJatuhTempo.mockResolvedValue(undefined);
    mockFns.bridgeUpdateStatus.mockResolvedValue(undefined);
    mockFns.bridgeUpdate.mockResolvedValue(undefined);
    mockFns.updateStatusPelanggan.mockResolvedValue(undefined);
    mockFns.handleStatusChange.mockResolvedValue(undefined);
    mockFns.notifyCustomerFinanceNotification.mockResolvedValue(true);
    mockFns.logActivity.mockResolvedValue(undefined);
    mockFns.onInvoicePaid.mockResolvedValue(undefined);
    mockFns.onIsolated.mockResolvedValue(undefined);
    mockFns.closeAbandonedManualTransfers.mockResolvedValue(0);
    mockFns.voidInvoiceTransaction.mockResolvedValue(true);
    mockFns.findSetting.mockResolvedValue({ value: "true" });
    mockFns.findOverdueInvoices.mockResolvedValue([{ pelangganId: "cust-1" }]);
    mockFns.reconcile.mockResolvedValue({
      scanned: 1,
      requeued: 1,
      pendingRequeued: 1,
      queuedRequeued: 0,
      failedRetried: 0,
      staleProcessingRecovered: 0,
      errors: 0,
    });
  });

  it("delegates invoice-paid due-date update via bridge without re-emitting INVOICE_PAID (prevents infinite loop)", async () => {
    mockFns.findInvoice.mockResolvedValue({
      id: "inv-1",
      status: "PAID",
      pelangganId: "cust-1",
      dueDate: new Date("2026-04-10T00:00:00.000Z"),
    });
    mockFns.bridgeFindById.mockResolvedValue({
      id: "cust-1",
      jatuhTempo: new Date("2026-04-01T00:00:00.000Z"),
      tipe: "REGULER",
      status: "ISOLIR",
    });

    await AutomaticBillingService.handleInvoicePaid("inv-1");

    // Jatuh tempo diupdate via bridge
    expect(mockFns.bridgeUpdateJatuhTempo).toHaveBeenCalledWith(
      "cust-1",
      expect.any(Date),
    );
    // INVOICE_PAID event TIDAK di-emit ulang dari dalam handler chain
    // (mencegah infinite loop: handler → emit → handler → ...)
    // Emit hanya terjadi di initiator: webhook, manual payment, void invoice
    expect(mockFns.onInvoicePaid).not.toHaveBeenCalled();
    // Direct updateStatusPelanggan TIDAK dipanggil dari service layer
    expect(mockFns.updateStatusPelanggan).not.toHaveBeenCalled();
    expect(mockFns.bridgeUpdateStatus).not.toHaveBeenCalled();
    expect(mockFns.handleStatusChange).not.toHaveBeenCalled();
  });

  it("delegates legacy overdue check to billing schedule reconciliation", async () => {
    const result = await AutomaticIsolationService.runDailyCheck();

    expect(mockFns.reconcile).toHaveBeenCalledOnce();
    expect(mockFns.updateStatusPelanggan).not.toHaveBeenCalled();
    expect(mockFns.bridgeUpdate).not.toHaveBeenCalled();
    expect(mockFns.handleStatusChange).not.toHaveBeenCalled();
    expect(result).toEqual({
      scanned: 1,
      requeued: 1,
      pendingRequeued: 1,
      queuedRequeued: 0,
      failedRetried: 0,
      staleProcessingRecovered: 0,
      errors: 0,
    });
  });

  it("delegates void-invoice isolation via CustomerEventDispatcher.onIsolated and keeps jatuh tempo update separate", async () => {
    mockFns.findInvoice.mockResolvedValue({
      id: "inv-1",
      invoiceNumber: "INV-001",
      status: "PAID",
      notes: null,
      totalAmount: 100000,
      pelangganId: "cust-1",
    });
    mockFns.bridgeFindById.mockResolvedValue({
      id: "cust-1",
      userId: "user-1",
      status: "AKTIF",
      jatuhTempo: new Date("2026-04-20T00:00:00.000Z"),
    });

    await VoidInvoiceService.voidInvoice("inv-1", "requested", "admin-1");

    expect(mockFns.bridgeUpdate).toHaveBeenCalledTimes(1);
    expect(mockFns.bridgeUpdate.mock.calls[0][0]).toBe("cust-1");
    expect(mockFns.bridgeUpdate.mock.calls[0][1]).toEqual({
      jatuhTempo: expect.any(Date),
    });
    // Isolation via event, bukan direct call
    expect(mockFns.onIsolated).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: "cust-1",
        newStatus: "ISOLIR",
      }),
    );
    expect(mockFns.updateStatusPelanggan).not.toHaveBeenCalled();
    expect(mockFns.handleStatusChange).not.toHaveBeenCalled();
    expect(mockFns.closeAbandonedManualTransfers).toHaveBeenCalledWith("inv-1");
  });

  // Pembatalannya sudah tersimpan dan tidak bisa diulang (invoice tidak lagi
  // PAID/PARTIAL_PAID), jadi jatuh tempo pelanggan tetap harus dikembalikan.
  it("void tetap mengembalikan jatuh tempo bila transfer tanpa bukti gagal ditutup", async () => {
    mockFns.findInvoice.mockResolvedValue({
      id: "inv-1",
      invoiceNumber: "INV-001",
      status: "PARTIAL_PAID",
      notes: null,
      totalAmount: 100000,
      pelangganId: "cust-1",
    });
    mockFns.bridgeFindById.mockResolvedValue({
      id: "cust-1",
      status: "ISOLIR",
      jatuhTempo: new Date("2026-04-20T00:00:00.000Z"),
    });
    mockFns.closeAbandonedManualTransfers.mockRejectedValue(
      new Error("billing DB putus"),
    );

    await expect(
      VoidInvoiceService.voidInvoice("inv-1", "salah tagih", "admin-1"),
    ).resolves.toMatchObject({ success: true });

    expect(mockFns.bridgeUpdate).toHaveBeenCalledWith("cust-1", {
      jatuhTempo: new Date("2026-03-20T00:00:00.000Z"),
    });
    expect(mockFns.logError).toHaveBeenCalledWith(
      expect.stringContaining("inv-1 gagal ditutup"),
      expect.any(Error),
    );
  });

  // Klik ganda: void kedua menemukan invoice yang sudah dibatalkan dan tidak
  // boleh memundurkan jatuh tempo pelanggan sebulan lagi.
  it("void yang kalah dari void lain ditolak tanpa memundurkan jatuh tempo", async () => {
    mockFns.findInvoice.mockResolvedValue({
      id: "inv-1",
      invoiceNumber: "INV-001",
      status: "PAID",
      notes: null,
      discountAmount: 0n,
      totalAmount: 100000,
      pelangganId: "cust-1",
    });
    mockFns.voidInvoiceTransaction.mockResolvedValue(false);

    await expect(
      VoidInvoiceService.voidInvoice("inv-1", "salah tagih", "admin-1"),
    ).rejects.toThrow(/^CONFLICT: Tagihan INV-001 baru saja diubah/);

    expect(mockFns.bridgeUpdate).not.toHaveBeenCalled();
    expect(mockFns.closeAbandonedManualTransfers).not.toHaveBeenCalled();
  });
});
