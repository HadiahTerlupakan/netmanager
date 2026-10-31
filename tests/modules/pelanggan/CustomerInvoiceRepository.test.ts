import { beforeEach, describe, expect, it, type Mock } from "vitest";

import { prismaMock } from "../../setup";
import { CustomerInvoiceRepository } from "@/modules/pelanggan/repositories/CustomerInvoiceRepository";

const repository = new CustomerInvoiceRepository();
// Model ini tidak terdaftar di tipe MockPrismaClient, tetapi proxy-nya ada.
const bankAccounts = (
  prismaMock as unknown as { companyBankAccount: { findMany: Mock } }
).companyBankAccount;

function invoiceRow(payment: Record<string, unknown>) {
  return {
    id: "inv-1",
    invoiceNumber: "INV-001",
    status: "SENT",
    issueDate: new Date("2026-10-01T00:00:00Z"),
    dueDate: new Date("2026-10-10T17:00:00Z"),
    subtotal: 100000n,
    taxAmount: 0n,
    discountAmount: 0n,
    totalAmount: 100000n,
    paidAmount: 0n,
    invoiceItem: [] as unknown[],
    payment: [
      {
        id: "pay-1",
        amount: 100000n,
        paymentDate: new Date("2026-10-05T00:00:00Z"),
        paymentMethod: "BANK_TRANSFER",
        accountId: null as string | null,
        gatewayStatus: "PENDING",
        expiresAt: null as Date | null,
        paymentUrl: null as string | null,
        vaNumber: null as string | null,
        qrString: null as string | null,
        gatewayProvider: null as string | null,
        receiptUrl: null as string | null,
        checkoutId: null as string | null,
        rejectionReason: null as string | null,
        ...payment,
      },
    ],
  };
}

async function lastPaymentOf(payment: Record<string, unknown>) {
  prismaMock.invoice.findMany.mockResolvedValue([invoiceRow(payment)]);
  prismaMock.invoice.count.mockResolvedValue(1);
  const { invoices } = await repository.findAllForCustomer("cust-1", {
    page: 1,
    limit: 10,
  });
  return repository.formatInvoicesForResponse(invoices)[0].lastPayment;
}

describe("CustomerInvoiceRepository", () => {
  beforeEach(() => {
    prismaMock.payment.findMany.mockResolvedValue([]);
    bankAccounts.findMany.mockResolvedValue([]);
  });

  // Pelanggan yang sudah mentransfer tetap perlu melihat rekening tujuannya,
  // walau admin sudah menonaktifkan rekening itu dari daftar metode.
  it("transfer manual membawa rekening tujuannya, termasuk yang sudah nonaktif", async () => {
    bankAccounts.findMany.mockResolvedValue([
      {
        id: "rekening-1",
        bankName: "BCA",
        accountName: "PT Net",
        accountNumber: "1234567890",
      },
    ]);

    await expect(
      lastPaymentOf({ accountId: "rekening-1" }),
    ).resolves.toMatchObject({
      bankAccount: {
        bankName: "BCA",
        accountName: "PT Net",
        accountNumber: "1234567890",
      },
    });
    expect(bankAccounts.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["rekening-1"] } },
      select: {
        id: true,
        bankName: true,
        accountName: true,
        accountNumber: true,
      },
    });
  });

  it("pembayaran gateway tidak punya rekening tujuan", async () => {
    await expect(
      lastPaymentOf({ gatewayProvider: "BC" }),
    ).resolves.toMatchObject({ bankAccount: null });
    expect(bankAccounts.findMany).not.toHaveBeenCalled();
  });

  // Portal dan aplikasi membedakan transfer manual dari VA lewat field ini;
  // tanpa alasan penolakan, pelanggan hanya melihat "gagal".
  it("transfer manual yang ditolak membawa isManual dan alasannya", async () => {
    await expect(
      lastPaymentOf({
        accountId: "rekening-1",
        gatewayStatus: "FAILED",
        rejectionReason: "Nominal transfer kurang Rp 5.000",
      }),
    ).resolves.toMatchObject({
      isManual: true,
      gatewayStatus: "FAILED",
      rejectionReason: "Nominal transfer kurang Rp 5.000",
    });
  });

  it("pembayaran tanpa checkout: total checkout sama dengan nominalnya", async () => {
    await expect(lastPaymentOf({})).resolves.toMatchObject({
      checkoutId: null,
      checkoutTotal: 100000,
      checkoutInvoiceNumbers: ["INV-001"],
      isManual: false,
    });
    expect(prismaMock.payment.findMany).not.toHaveBeenCalled();
  });

  it("checkout beberapa invoice: total dan nomor invoice urut jatuh tempo", async () => {
    prismaMock.payment.findMany.mockResolvedValue([
      {
        checkoutId: "c1",
        amount: 150000n,
        invoice: {
          invoiceNumber: "INV-002",
          dueDate: new Date("2026-11-10T17:00:00Z"),
        },
      },
      {
        checkoutId: "c1",
        amount: 100000n,
        invoice: {
          invoiceNumber: "INV-001",
          dueDate: new Date("2026-10-10T17:00:00Z"),
        },
      },
    ]);

    await expect(lastPaymentOf({ checkoutId: "c1" })).resolves.toMatchObject({
      amount: 100000,
      checkoutId: "c1",
      checkoutTotal: 250000,
      checkoutInvoiceNumbers: ["INV-001", "INV-002"],
    });
  });

  it("ringkasan tagihan dasbor membawa saldo kredit pelanggan", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([]);
    prismaMock.pelanggan.findUnique.mockResolvedValue({
      saldoKreditRupiah: 15000n,
    });

    await expect(
      repository.getDashboardBillingSummary("cust-1"),
    ).resolves.toMatchObject({ outstandingCount: 0, saldoKredit: 15000 });
  });

  it("saldo kredit pelanggan yang tidak ditemukan dianggap nol", async () => {
    prismaMock.pelanggan.findUnique.mockResolvedValue(null);

    await expect(repository.getSaldoKredit("cust-x")).resolves.toBe(0);
  });
});
