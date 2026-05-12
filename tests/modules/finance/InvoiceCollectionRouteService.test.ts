import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvoiceStatus } from "@prisma/client-billing";

const mockFns = vi.hoisted(() => ({
  findByIdWithSite: vi.fn(),
  findPelangganById: vi.fn(),
  findPaginatedWithItemsAndPayments: vi.fn(),
  countInvoicesByMonth: vi.fn(),
  createInvoiceWithItems: vi.fn(),
  syncInvoiceBillingSchedules: vi.fn(() => Promise.resolve()),
  cancelInvoiceBillingSchedules: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/modules/users", () => ({
  UserLookupService: class MockUserLookupService {
    findByIdWithSite = mockFns.findByIdWithSite;
  },
}));

vi.mock("@/modules/pelanggan", () => ({
  PelangganAdminQueryService: class MockPelangganAdminQueryService {
    getPppMutationContext = mockFns.findPelangganById;
  },
}));

vi.mock("@/modules/finance/repositories/InvoiceRepository", () => ({
  InvoiceRepository: class MockInvoiceRepository {
    findPaginatedWithItemsAndPayments =
      mockFns.findPaginatedWithItemsAndPayments;
    countByMonth = mockFns.countInvoicesByMonth;
    createWithItems = mockFns.createInvoiceWithItems;
  },
}));

vi.mock("@/lib/logger", () => ({
  logActivitySafe: vi.fn(),
}));

vi.mock("@/modules/finance/services/billingScheduleLifecycle", () => ({
  syncInvoiceBillingSchedules: mockFns.syncInvoiceBillingSchedules,
  cancelInvoiceBillingSchedules: mockFns.cancelInvoiceBillingSchedules,
}));

import {
  createInvoiceForRoute,
  listInvoicesForRoute,
} from "@/modules/finance/services/InvoiceCollectionRouteService";

describe("InvoiceCollectionRouteService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty pagination when restricted user has no site", async () => {
    mockFns.findByIdWithSite.mockResolvedValue({ name: "User", siteId: null });

    await expect(
      listInvoicesForRoute({
        filters: { page: 2, limit: 10 },
        user: { id: "user-1", role: "ADMIN" },
        isRestricted: true,
      }),
    ).resolves.toEqual({
      data: [],
      pagination: {
        page: 2,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    });

    expect(mockFns.findPaginatedWithItemsAndPayments).not.toHaveBeenCalled();
  });

  it("lists invoices with status and site filters", async () => {
    mockFns.findByIdWithSite.mockResolvedValue({
      name: "User",
      siteId: "site-1",
    });
    mockFns.findPaginatedWithItemsAndPayments.mockResolvedValue({
      data: [{ id: "inv-1" }],
      total: 1,
    });

    await listInvoicesForRoute({
      filters: { status: "SENT", page: 1, limit: 20, search: "INV" },
      user: { id: "user-1", role: "ADMIN" },
      isRestricted: true,
    });

    expect(mockFns.findPaginatedWithItemsAndPayments).toHaveBeenCalledWith({
      where: {
        siteId: "site-1",
        status: "SENT",
        OR: [{ invoiceNumber: { contains: "INV", mode: "insensitive" } }],
      },
      page: 1,
      limit: 20,
    });
  });

  it("creates invoice with generated number and processed item amounts", async () => {
    mockFns.findPelangganById.mockResolvedValue({
      id: "cust-1",
      siteId: "site-1",
    });
    mockFns.countInvoicesByMonth.mockResolvedValue(4);
    mockFns.createInvoiceWithItems.mockResolvedValue({
      id: "inv-1",
      invoiceNumber: "INV/2026/04/0005",
      pelangganId: "cust-1",
      dueDate: new Date("2026-04-30T00:00:00.000Z"),
      status: InvoiceStatus.SENT,
      subtotal: 50000n,
      taxAmount: 0n,
      discountAmount: 0n,
      totalAmount: 50000n,
      invoiceItem: [{ unitPrice: 50000n, totalPrice: 50000n }],
    });

    const result = await createInvoiceForRoute({
      input: {
        pelangganId: "cust-1",
        issueDate: "2026-04-01",
        dueDate: "2026-04-30",
        status: InvoiceStatus.SENT,
        taxAmount: 0,
        discountAmount: 0,
        items: [
          {
            description: "Internet",
            quantity: 1,
            unitPrice: 50000,
            itemType: "SERVICE",
          },
        ],
      },
      user: { id: "user-1", role: "SUPER_ADMIN" },
      isRestricted: false,
      now: new Date("2026-04-10T00:00:00.000Z"),
    });

    expect(mockFns.createInvoiceWithItems).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceNumber: "INV/2026/04/0005",
        pelangganId: "cust-1",
        siteId: "site-1",
        subtotal: 50000n,
        totalAmount: 50000n,
      }),
    );
    expect(result).toMatchObject({
      status: "created",
      data: {
        id: "inv-1",
        subtotal: "50000",
        invoiceItem: [{ unitPrice: "50000", totalPrice: "50000" }],
      },
    });
    expect(mockFns.syncInvoiceBillingSchedules).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "inv-1",
        pelangganId: "cust-1",
        status: InvoiceStatus.SENT,
      }),
    );
  });

  it("rejects restricted creation for customers outside user site", async () => {
    mockFns.findByIdWithSite.mockResolvedValue({
      name: "User",
      siteId: "site-1",
    });
    mockFns.findPelangganById.mockResolvedValue({
      id: "cust-1",
      siteId: "site-2",
    });

    await expect(
      createInvoiceForRoute({
        input: {
          pelangganId: "cust-1",
          issueDate: "2026-04-01",
          dueDate: "2026-04-30",
          status: InvoiceStatus.SENT,
          taxAmount: 0,
          discountAmount: 0,
          items: [],
        },
        user: { id: "user-1", role: "ADMIN" },
        isRestricted: true,
      }),
    ).resolves.toEqual({ status: "forbidden-customer-site" });
  });
});
