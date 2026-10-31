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
  syncInvoiceBillingSchedules: vi.fn(),
  cancelInvoiceBillingSchedules: vi.fn(),
  closeAbandonedManualTransfers: vi.fn(),
  cancelOutstandingInvoice: vi.fn(),
  findInvoiceDeleteBlocker: vi.fn(),
  underCheckoutLock: vi.fn(),
}));

vi.mock("@/modules/users/repositories/UserRepository", () => ({
  UserRepository: class MockUserRepository {
    findByIdWithSite = mockFns.findByIdWithSite;
  },
}));

vi.mock("@/modules/pelanggan/repositories/PelangganRepository", () => ({
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

vi.mock("@/modules/finance/services/billingScheduleLifecycle", () => ({
  syncInvoiceBillingSchedules: mockFns.syncInvoiceBillingSchedules,
  cancelInvoiceBillingSchedules: mockFns.cancelInvoiceBillingSchedules,
}));

vi.mock("@/modules/finance/services/abandoned-manual-transfer", () => ({
  closeAbandonedManualTransfers: mockFns.closeAbandonedManualTransfers,
}));

vi.mock("@/modules/finance/services/outstanding-invoice.helpers", () => ({
  cancelOutstandingInvoice: mockFns.cancelOutstandingInvoice,
  findInvoiceDeleteBlocker: mockFns.findInvoiceDeleteBlocker,
}));

vi.mock("@/modules/finance/services/customer-checkout-lock", () => ({
  runAdminActionUnderCustomerCheckoutLock: mockFns.underCheckoutLock,
}));

vi.mock("@/modules/payment-gateway", () => ({
  findPaymentMethodByCode: vi.fn(),
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
    mockFns.underCheckoutLock.mockImplementation(
      (_pelangganId: string, _reason: string, task: () => Promise<unknown>) =>
        task(),
    );
    mockFns.cancelOutstandingInvoice.mockResolvedValue(null);
    mockFns.findInvoiceDeleteBlocker.mockResolvedValue(null);
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
    expect(mockFns.cancelOutstandingInvoice).not.toHaveBeenCalled();
  });

  it("cancels through the shared cancellation under the customer's checkout lock, then saves the other changes", async () => {
    mockFns.findInvoiceWithRelations.mockResolvedValue({
      ...baseInvoice,
      status: "SENT",
    });
    mockFns.updateInvoiceWithItems.mockResolvedValue({
      ...baseInvoice,
      status: "CANCELLED",
    });

    await updateInvoiceForRoute({
      invoiceId: "inv-1",
      user: { id: "user-1", role: "SUPER_ADMIN" },
      isRestricted: false,
      input: { status: "CANCELLED", notes: "Pelanggan berhenti" },
    });

    expect(mockFns.underCheckoutLock).toHaveBeenCalledWith(
      "cust-1",
      "cancel-invoice",
      expect.any(Function),
    );
    expect(mockFns.cancelOutstandingInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceId: "inv-1", cancelledBy: "user-1" }),
    );
    expect(mockFns.updateInvoiceWithItems).toHaveBeenCalledWith(
      expect.objectContaining({ updateData: { notes: "Pelanggan berhenti" } }),
    );
  });

  it("refuses with 409 and changes nothing when the cancellation is kept", async () => {
    mockFns.findInvoiceWithRelations.mockResolvedValue({
      ...baseInvoice,
      status: "SENT",
    });
    mockFns.cancelOutstandingInvoice.mockResolvedValue({
      message:
        "Tagihan INV-1 tidak dibatalkan karena pelanggan sedang membayar (BCA VA aktif sampai 2 Nov 2026 10.00 WIB).",
    });

    await expect(
      updateInvoiceForRoute({
        invoiceId: "inv-1",
        user: { id: "user-1", role: "SUPER_ADMIN" },
        isRestricted: false,
        input: { status: "CANCELLED" },
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("pelanggan sedang membayar"),
    });
    expect(mockFns.updateInvoiceWithItems).not.toHaveBeenCalled();
  });

  it("does not cancel again an invoice that is already cancelled", async () => {
    mockFns.findInvoiceWithRelations.mockResolvedValue({
      ...baseInvoice,
      status: "CANCELLED",
    });
    mockFns.updateInvoiceWithItems.mockResolvedValue({
      ...baseInvoice,
      status: "CANCELLED",
    });

    await updateInvoiceForRoute({
      invoiceId: "inv-1",
      user: { id: "user-1", role: "SUPER_ADMIN" },
      isRestricted: false,
      input: { status: "CANCELLED", notes: "Catatan" },
    });

    expect(mockFns.cancelOutstandingInvoice).not.toHaveBeenCalled();
    expect(mockFns.updateInvoiceWithItems).toHaveBeenCalled();
  });

  // Penghapusan melepas invoiceId payment-nya, jadi transfer tanpa bukti
  // harus ditutup selagi masih bisa ditemukan dari tagihannya.
  it("cancels billing schedules and closes manual transfers without proof before deleting an existing invoice", async () => {
    mockFns.findInvoiceWithRelations.mockResolvedValue(baseInvoice);

    await deleteInvoiceForRoute({
      invoiceId: "inv-1",
      user: { id: "user-1", role: "SUPER_ADMIN" },
      isRestricted: false,
    });

    expect(mockFns.underCheckoutLock).toHaveBeenCalledWith(
      "cust-1",
      "delete-invoice",
      expect.any(Function),
    );
    expect(mockFns.cancelInvoiceBillingSchedules).toHaveBeenCalledWith("inv-1");
    expect(mockFns.closeAbandonedManualTransfers).toHaveBeenCalledWith("inv-1");
    expect(mockFns.deleteInvoice).toHaveBeenCalledWith("inv-1");
    expect(
      mockFns.closeAbandonedManualTransfers.mock.invocationCallOrder[0],
    ).toBeLessThan(mockFns.deleteInvoice.mock.invocationCallOrder[0]);
  });

  it("refuses with 409 to delete an invoice that is being paid", async () => {
    mockFns.findInvoiceWithRelations.mockResolvedValue(baseInvoice);
    mockFns.findInvoiceDeleteBlocker.mockResolvedValue(
      "Tagihan punya bukti transfer yang belum diverifikasi; tolak atau setujui dulu.",
    );

    await expect(
      deleteInvoiceForRoute({
        invoiceId: "inv-1",
        user: { id: "user-1", role: "SUPER_ADMIN" },
        isRestricted: false,
      }),
    ).rejects.toMatchObject({
      status: 409,
      message:
        "Tagihan punya bukti transfer yang belum diverifikasi; tolak atau setujui dulu.",
    });
    expect(mockFns.closeAbandonedManualTransfers).not.toHaveBeenCalled();
    expect(mockFns.deleteInvoice).not.toHaveBeenCalled();
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
      dueDate: new Date("2026-05-20T00:00:00.000Z"),
      totalAmount: 1100n,
      paidAmount: 0n,
      subtotal: 1000n,
      taxAmount: 100n,
      discountAmount: 0n,
      invoiceItem: [],
      payment: [],
    });
    mockFns.markInvoiceSent.mockResolvedValue({
      id: "inv-1",
      status: "SENT",
      pelangganId: "cust-1",
      siteId: "site-1",
      dueDate: new Date("2026-05-20T00:00:00.000Z"),
      totalAmount: 1100n,
      paidAmount: 0n,
      subtotal: 1000n,
      taxAmount: 100n,
      discountAmount: 0n,
      invoiceItem: [],
      payment: [],
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
    expect(mockFns.syncInvoiceBillingSchedules).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "inv-1",
        status: "SENT",
        pelangganId: "cust-1",
      }),
    );
  });
});
