import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  findByIdWithSite: vi.fn(),
  findInvoiceWithRelations: vi.fn(),
  findInvoiceWithRelationsBySite: vi.fn(),
  findPelangganById: vi.fn(),
  updateInvoiceWithItems: vi.fn(),
  deleteInvoice: vi.fn(),
  findInvoiceForSend: vi.fn(),
  markInvoiceSent: vi.fn(),
}));

vi.mock("@/modules/users", () => ({
  UserRepository: class MockUserRepository {
    findByIdWithSite = mockFns.findByIdWithSite;
  },
}));

vi.mock("@/modules/pelanggan", () => ({
  PelangganRepository: class MockPelangganRepository {
    findById = mockFns.findPelangganById;
  },
}));

vi.mock("@/modules/finance/repositories/InvoiceRepository", () => ({
  InvoiceRepository: class MockInvoiceRepository {
    findWithItemsAndPayments = mockFns.findInvoiceWithRelations;
    findWithItemsAndPaymentsBySite = mockFns.findInvoiceWithRelationsBySite;
    updateWithItemsTransaction = mockFns.updateInvoiceWithItems;
    deleteById = mockFns.deleteInvoice;
    findInvoiceForSend = mockFns.findInvoiceForSend;
    markAsSent = mockFns.markInvoiceSent;
  },
}));

import {
  deleteInvoiceForRoute,
  getInvoiceForRoute,
  sendInvoiceForRoute,
  updateInvoiceForRoute,
} from "@/modules/finance/services/InvoiceRouteService";

const baseInvoice = {
  id: "inv-1",
  pelangganId: "cust-1",
  siteId: "site-1",
  subtotal: 1000n,
  taxAmount: 100n,
  discountAmount: 0n,
  totalAmount: 1100n,
  paidAmount: 500n,
  invoiceItem: [{ id: "item-1", unitPrice: 1000n, totalPrice: 1000n }],
  payment: [{ id: "pay-1", amount: 500n }],
};

describe("InvoiceRouteService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns serialized invoice and pelanggan for unrestricted access", async () => {
    mockFns.findInvoiceWithRelations.mockResolvedValue(baseInvoice);
    mockFns.findPelangganById.mockResolvedValue({ id: "cust-1", nama: "Budi" });

    await expect(
      getInvoiceForRoute({
        invoiceId: "inv-1",
        user: { id: "user-1", role: "SUPER_ADMIN" },
        isRestricted: false,
      }),
    ).resolves.toMatchObject({
      id: "inv-1",
      subtotal: 1000,
      totalAmount: 1100,
      paidAmount: 500,
      pelanggan: { id: "cust-1" },
      invoiceItem: [{ unitPrice: 1000, totalPrice: 1000 }],
      payment: [{ amount: 500 }],
    });

    expect(mockFns.findInvoiceWithRelations).toHaveBeenCalledWith("inv-1");
    expect(mockFns.findPelangganById).toHaveBeenCalledWith("cust-1");
  });

  it("returns not-found when restricted user has no site", async () => {
    mockFns.findByIdWithSite.mockResolvedValue({ name: "User", siteId: null });

    await expect(
      getInvoiceForRoute({
        invoiceId: "inv-1",
        user: { id: "user-1", role: "ADMIN" },
        isRestricted: true,
      }),
    ).resolves.toBeNull();

    expect(mockFns.findInvoiceWithRelationsBySite).not.toHaveBeenCalled();
  });

  it("updates invoice items through repository transaction", async () => {
    mockFns.findInvoiceWithRelations.mockResolvedValue(baseInvoice);
    mockFns.updateInvoiceWithItems.mockResolvedValue({
      ...baseInvoice,
      subtotal: 2000n,
      totalAmount: 2000n,
      invoiceItem: [{ id: "item-2", unitPrice: 2000n, totalPrice: 2000n }],
    });
    mockFns.findPelangganById.mockResolvedValue({ id: "cust-1" });

    await updateInvoiceForRoute({
      invoiceId: "inv-1",
      user: { id: "user-1", role: "SUPER_ADMIN" },
      isRestricted: false,
      input: {
        subtotal: 2000,
        totalAmount: 2000,
        invoiceItem: [
          {
            description: "Internet",
            quantity: 1,
            unitPrice: 2000,
            totalPrice: 2000,
          },
        ],
      },
    });

    expect(mockFns.updateInvoiceWithItems).toHaveBeenCalledWith({
      invoiceId: "inv-1",
      invoiceItem: [
        {
          description: "Internet",
          quantity: 1,
          unitPrice: 2000,
          totalPrice: 2000,
        },
      ],
      updateData: {
        subtotal: 2000n,
        totalAmount: 2000n,
      },
    });
  });

  it("deletes an existing invoice through repository", async () => {
    mockFns.findInvoiceWithRelations.mockResolvedValue(baseInvoice);

    await deleteInvoiceForRoute({
      invoiceId: "inv-1",
      user: { id: "user-1", role: "SUPER_ADMIN" },
      isRestricted: false,
    });

    expect(mockFns.deleteInvoice).toHaveBeenCalledWith("inv-1");
  });

  it("sends draft invoice using fallback customer contact", async () => {
    mockFns.findByIdWithSite.mockResolvedValue({
      name: "User",
      siteId: "site-1",
    });
    mockFns.findInvoiceForSend.mockResolvedValue({
      id: "inv-1",
      status: "DRAFT",
      pelangganId: "cust-1",
      siteId: "site-1",
      invoiceItem: [],
    });
    mockFns.findPelangganById.mockResolvedValue({
      id: "cust-1",
      email: "cust@example.com",
      noTelp: "08123",
    });

    await expect(
      sendInvoiceForRoute({
        invoiceId: "inv-1",
        user: { id: "user-1", role: "ADMIN" },
        input: { sendMethod: "BOTH" },
      }),
    ).resolves.toEqual({ status: "sent", sentVia: ["EMAIL", "WHATSAPP"] });

    expect(mockFns.markInvoiceSent).toHaveBeenCalledWith("inv-1");
  });
});
