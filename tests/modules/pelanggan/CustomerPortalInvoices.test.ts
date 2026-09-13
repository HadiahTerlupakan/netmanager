import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindAllForCustomer = vi.hoisted(() => vi.fn());
const mockFormatInvoicesForResponse = vi.hoisted(() => vi.fn());

vi.mock("@/modules/pelanggan/repositories/CustomerInvoiceRepository", () => ({
  CustomerInvoiceRepository: class MockCustomerInvoiceRepository {
    findAllForCustomer = (...args: unknown[]) =>
      mockFindAllForCustomer(...args);
    formatInvoicesForResponse = (...args: unknown[]) =>
      mockFormatInvoicesForResponse(...args);
  },
}));

const mockGetInvoicesByIds = vi.hoisted(() => vi.fn());

vi.mock("@/modules/pelanggan/repositories/PelangganRepository", () => ({
  PelangganRepository: class MockPelangganRepository {
    getInvoicesByIds = (...args: unknown[]) => mockGetInvoicesByIds(...args);
  },
}));

describe("CustomerPortalService.getInvoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns invoices in the portal DTO shape expected by the tagihan page", async () => {
    const rawInvoice = {
      id: "inv-1",
      invoiceItem: [] as unknown[],
      payment: [] as unknown[],
    };
    const formattedInvoice = {
      id: "inv-1",
      invoiceNumber: "INV-DEV-0001",
      totalAmount: 150000,
      paidAmount: 50000,
      remainingAmount: 100000,
      items: [{ description: "Langganan Internet" }],
      lastPayment: null as unknown,
    };
    mockFindAllForCustomer.mockResolvedValueOnce({
      invoices: [rawInvoice],
      total: 1,
    });
    mockFormatInvoicesForResponse.mockReturnValueOnce([formattedInvoice]);

    const { CustomerPortalService } =
      await import("@/modules/pelanggan/services/CustomerPortalService");

    const service = new CustomerPortalService();
    const result = await service.getInvoices("cust-1", 1, 20, ["SENT"]);

    expect(mockFindAllForCustomer).toHaveBeenCalledWith("cust-1", {
      page: 1,
      limit: 20,
      status: ["SENT"],
    });
    expect(mockFormatInvoicesForResponse).toHaveBeenCalledWith([rawInvoice]);
    expect(result.invoices).toEqual([formattedInvoice]);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });
});

describe("CustomerPortalService.validateInvoicesForPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("treats partially paid invoices as payable and charges only the remainder", async () => {
    mockGetInvoicesByIds.mockResolvedValueOnce([
      { id: "inv-1", totalAmount: 150000, paidAmount: 50000 },
    ]);

    const { CustomerPortalService } =
      await import("@/modules/pelanggan/services/CustomerPortalService");

    const service = new CustomerPortalService();
    const result = await service.validateInvoicesForPayment(
      ["inv-1"],
      "cust-1",
    );

    expect(mockGetInvoicesByIds).toHaveBeenCalledWith(["inv-1"], "cust-1", [
      "SENT",
      "OVERDUE",
      "PARTIAL_PAID",
    ]);
    expect(result.totalAmount).toBe(100000);
  });
});
