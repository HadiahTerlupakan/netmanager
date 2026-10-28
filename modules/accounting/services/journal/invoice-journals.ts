import { prisma } from "@/lib/prisma";
import { prismaBilling } from "@/lib/prisma-billing";
import {
  resolveInvoiceCreatedCoa,
  resolveInvoiceReceiptCoa,
} from "../event-handlers/coa-resolver";
import { buildInvoicePaidLines } from "../event-handlers/invoice-paid-lines";
import {
  autoPostingService,
  ensurePeriod,
  journalReverseService,
} from "./auto-posting";

/**
 * Jurnal tagihan pelanggan: piutang saat terbit, penerimaan per pembayaran,
 * dan pembaliknya saat pembayaran atau tagihan dibatalkan.
 *
 * Penerimaan dibukukan per pembayaran, bukan sekali saat lunas: pembayaran
 * sebagian dulu tidak pernah berjurnal, padahal uangnya sudah masuk.
 */

/**
 * Referensi jurnal penerimaan satu pembayaran. Kunci jurnal otomatis unik per
 * (tenant, sumber, referensi), jadi event yang diulang tidak menggandakan
 * jurnal, dan pembayaran ulang setelah pembatalan tetap mendapat jurnal baru.
 */
export function invoiceReceiptRef(invoiceId: string, paymentId: string) {
  return `${invoiceId}:${paymentId}`;
}

/** Piutang tagihan: Debit Piutang Usaha, Kredit Pendapatan. */
export async function postInvoiceAccrual(invoiceId: string) {
  const invoice = await prismaBilling.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      tenantId: true,
      invoiceNumber: true,
      totalAmount: true,
      createdAt: true,
      status: true,
    },
  });
  if (
    !invoice?.tenantId ||
    invoice.status === "CANCELLED" ||
    invoice.totalAmount <= 0n
  ) {
    return false;
  }

  const { debitCoaId, creditCoaId } = await resolveInvoiceCreatedCoa(
    invoice.tenantId,
  );
  const amount = invoice.totalAmount.toString();
  await ensurePeriod(invoice.tenantId, invoice.createdAt);
  await autoPostingService().postAuto(invoice.tenantId, {
    source: "AUTO_INVOICE_CREATED",
    sourceRefType: "Invoice",
    sourceRefId: invoiceId,
    entryDate: invoice.createdAt,
    description: `Tagihan ${invoice.invoiceNumber} diterbitkan`,
    lines: [
      { coaId: debitCoaId, side: "DEBIT", amount },
      { coaId: creditCoaId, side: "CREDIT", amount },
    ],
  });
  return true;
}

/**
 * Jurnal penerimaan untuk setiap pembayaran tagihan yang uangnya sudah
 * diterima. Piutangnya dibukukan lebih dulu: tagihan prorate dan tagihan
 * manual tidak mengirim event terbit, dan tanpa itu Piutang jadi minus.
 */
export async function postInvoiceReceipts(invoiceId: string) {
  const invoice = await prismaBilling.invoice.findUnique({
    where: { id: invoiceId },
    select: { tenantId: true, invoiceNumber: true, status: true },
  });
  if (!invoice?.tenantId || invoice.status === "CANCELLED") return 0;
  const tenantId = invoice.tenantId;

  const received = await prismaBilling.payment.findMany({
    where: {
      invoiceId,
      amount: { gt: 0 },
      OR: [{ gatewayStatus: "PAID" }, { gatewayStatus: null }],
    },
    orderBy: { paymentDate: "asc" },
    select: {
      id: true,
      amount: true,
      gatewayFee: true,
      accountId: true,
      expiresAt: true,
      gatewayProvider: true,
      paymentDate: true,
    },
  });
  if (received.length === 0) return 0;

  await postInvoiceAccrual(invoiceId);
  const payments = received.map((payment) => ({
    ...payment,
    isGateway: Boolean(payment.expiresAt || payment.gatewayProvider),
  }));
  const coa = await resolveInvoiceReceiptCoa(
    tenantId,
    payments.flatMap((payment) =>
      payment.accountId && !payment.isGateway ? [payment.accountId] : [],
    ),
  );

  const posting = autoPostingService();
  for (const payment of payments) {
    await ensurePeriod(tenantId, payment.paymentDate);
    await posting.postAuto(tenantId, {
      source: "AUTO_INVOICE_PAID",
      sourceRefType: "Invoice",
      sourceRefId: invoiceReceiptRef(invoiceId, payment.id),
      entryDate: payment.paymentDate,
      description: `Penerimaan pembayaran invoice ${invoice.invoiceNumber}`,
      lines: buildInvoicePaidLines([payment], coa),
    });
  }
  return payments.length;
}

type ReversalInput = {
  tenantId: string;
  invoiceId: string;
  reason: string;
  reversedBy: string;
};

async function reverseEntries(
  where: { tenantId: string; source: string; OR: object[] },
  input: ReversalInput,
) {
  const entries = await prisma.journalEntry.findMany({
    where: { ...where, status: "POSTED" },
    select: { id: true },
  });
  if (entries.length === 0) return 0;
  // Jurnal pembalik bertanggal hari ini; periodenya baru ada setelah jurnal
  // pertama bulan ini, dan tanpanya pembalikan ditolak.
  await ensurePeriod(input.tenantId, new Date());
  const reverser = journalReverseService();
  for (const entry of entries) {
    await reverser.reverse(entry.id, input.reason, input.reversedBy);
  }
  return entries.length;
}

/**
 * Balik jurnal penerimaan: hanya milik `paymentId` bila diberikan, atau
 * seluruh penerimaan tagihan. Jurnal lama memakai id invoice saja sebagai
 * referensi, jadi keduanya dicari.
 */
export async function reverseInvoiceReceiptJournals(
  input: ReversalInput & { paymentId?: string },
) {
  const refs = input.paymentId
    ? [{ sourceRefId: invoiceReceiptRef(input.invoiceId, input.paymentId) }]
    : [
        { sourceRefId: input.invoiceId },
        { sourceRefId: { startsWith: `${input.invoiceId}:` } },
      ];
  return reverseEntries(
    { tenantId: input.tenantId, source: "AUTO_INVOICE_PAID", OR: refs },
    input,
  );
}

/**
 * Tagihan dibatalkan: piutang, seluruh penerimaannya, dan potongan kupon
 * yang hanya menutup tagihan ini dibalik.
 */
export async function reverseCancelledInvoiceJournals(input: ReversalInput) {
  const receipts = await reverseInvoiceReceiptJournals(input);
  const accrual = await reverseEntries(
    {
      tenantId: input.tenantId,
      source: "AUTO_INVOICE_CREATED",
      OR: [{ sourceRefId: input.invoiceId }],
    },
    input,
  );
  const coupon = await reverseEntries(
    {
      tenantId: input.tenantId,
      source: "AUTO_COUPON_USED",
      OR: [{ sourceRefId: { endsWith: `:${input.invoiceId}` } }],
    },
    input,
  );
  return receipts + accrual + coupon;
}
