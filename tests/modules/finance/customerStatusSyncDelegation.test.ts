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
    error: vi.fn(),
  },
}));

vi.mock("@/modules/events", () => ({
  BillingEventDispatcher: {
    onInvoicePaid: mockFns.onInvoicePaid,
  },
}));

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
    mockFns.findSetting.mockResolvedValue({ value: "true" });
    mockFns.findOverdueInvoices.mockResolvedValue([{ pelangganId: "cust-1" }]);
  });

  it("delegates invoice-paid activation through pelanggan service instead of bridge status update", async () => {
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

    expect(mockFns.updateStatusPelanggan).toHaveBeenCalledWith(
      "cust-1",
      "AKTIF",
    );
    expect(mockFns.bridgeUpdateStatus).not.toHaveBeenCalled();
    expect(mockFns.handleStatusChange).not.toHaveBeenCalled();
  });

  it("delegates auto isolation through pelanggan service instead of manual bridge and radius sync", async () => {
    mockFns.bridgeFindById.mockResolvedValue({
      id: "cust-1",
      nama: "Customer 1",
      userId: "user-1",
      status: "AKTIF",
      autoIsolir: true,
      jatuhTempo: new Date("2026-04-01T00:00:00.000Z"),
    });

    await AutomaticIsolationService.runDailyCheck();

    expect(mockFns.updateStatusPelanggan).toHaveBeenCalledWith(
      "cust-1",
      "ISOLIR",
    );
    expect(mockFns.bridgeUpdate).not.toHaveBeenCalled();
    expect(mockFns.handleStatusChange).not.toHaveBeenCalled();
  });

  it("delegates void-invoice isolation through pelanggan service and keeps jatuh tempo update separate", async () => {
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
    expect(mockFns.updateStatusPelanggan).toHaveBeenCalledWith(
      "cust-1",
      "ISOLIR",
    );
    expect(mockFns.handleStatusChange).not.toHaveBeenCalled();
  });
});
