import { logger } from "@/lib/logger";
import { reverseInvoiceReceiptJournals } from "@/modules/accounting";
import { prismaBilling } from "@/modules/database";
import { sendCustomerPushNotification } from "@/modules/notification";
import { getPelangganServiceFromRegistry } from "../pelanggan-registry";
import { InvoicePaymentStateService } from "./InvoicePaymentStateService";

export class PaymentCancellationError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

/** Cancels a paid payment and reverses related invoice/customer state. */
export async function cancelPaidPayment(options: {
  paymentId: string;
  adminLabel: string;
  allowedSiteIds?: string[];
}) {
  const payment = await findPaymentWithInvoice(options.paymentId);
  const invoice = payment.invoice;

  // Validate scope: payment must belong to pelanggan in allowed sites
  if (options.allowedSiteIds && options.allowedSiteIds.length > 0) {
    const pelanggan = await getPelangganServiceFromRegistry().getPelanggan(
      invoice.pelangganId,
    );
    if (
      !pelanggan ||
      !pelanggan.siteId ||
      !options.allowedSiteIds.includes(pelanggan.siteId)
    ) {
      throw new PaymentCancellationError(
        "Anda tidak dapat membatalkan payment untuk pelanggan di luar scope Anda",
        403,
      );
    }
  }

  await cancelPayment(options.paymentId, options.adminLabel);
  const result = await new InvoicePaymentStateService().recompute(invoice.id);
  await reverseReceiptIfUnpaid(result, invoice, options.adminLabel);
  await notifyCustomer(payment.id, invoice.id, invoice.pelangganId);
}

/**
 * Invoice yang tidak lagi lunas setelah pembatalan: jurnal penerimaannya
 * dibalik, agar kas dan piutang di pembukuan kembali seperti sebelum dibayar.
 * Dulu pembatalan tidak membalik jurnal apa pun, sehingga kas tetap tercatat
 * bertambah untuk uang yang dianggap batal.
 */
async function reverseReceiptIfUnpaid(
  result: { previousStatus: string; invoice: { status: string } } | null,
  invoice: { id: string; tenantId?: string | null },
  adminLabel: string,
) {
  const wasPaid = result?.previousStatus === "PAID";
  if (!wasPaid || result.invoice.status === "PAID" || !invoice.tenantId) {
    return;
  }
  try {
    await reverseInvoiceReceiptJournals({
      tenantId: invoice.tenantId,
      invoiceId: invoice.id,
      reason: `Pembayaran dibatalkan oleh ${adminLabel}`,
      reversedBy: adminLabel,
    });
  } catch (error) {
    // Pembatalan sudah tersimpan; jurnal yang gagal dibalik dilaporkan dan
    // bisa dibalik manual dari menu Jurnal.
    logger.error(
      `[PaymentCancellation] Gagal membalik jurnal penerimaan invoice ${invoice.id}:`,
      error,
    );
  }
}

async function findPaymentWithInvoice(paymentId: string) {
  const payment = await prismaBilling.payment.findUnique({
    where: { id: paymentId },
    include: { invoice: true },
  });
  assertCancellablePayment(payment);
  return payment;
}

const GATEWAY_PAID_MESSAGE =
  "Pembayaran ini sudah diterima payment gateway dan tidak bisa dibatalkan dari sini. Kembalikan dana lewat dashboard gateway bila perlu.";

function assertCancellablePayment(
  payment: {
    gatewayStatus: string;
    invoice: unknown;
    expiresAt?: Date | null;
    gatewayProvider?: string | null;
  } | null,
) {
  if (!payment) {
    throw new PaymentCancellationError("Payment not found", 404);
  }
  if (payment.gatewayStatus !== "PAID") {
    throw new PaymentCancellationError(
      "Only PAID payments can be cancelled",
      400,
    );
  }
  if (!payment.invoice) {
    throw new PaymentCancellationError("Associated invoice not found", 404);
  }
  // Uang pembayaran gateway sudah masuk ke merchant. Membatalkannya di sini
  // hanya membuka tagihan lagi, sehingga pelanggan membayar dua kali
  // (terjadi di sandbox 2026-10-28) tanpa ada catatan bahwa dana perlu
  // dikembalikan.
  if (payment.expiresAt || payment.gatewayProvider) {
    throw new PaymentCancellationError(GATEWAY_PAID_MESSAGE, 409);
  }
}

function cancelPayment(paymentId: string, adminLabel: string) {
  return prismaBilling.payment.update({
    where: { id: paymentId },
    data: {
      gatewayStatus: "CANCELLED",
      notes: `Cancelled by admin ${adminLabel} on ${new Date().toISOString()}`,
    },
  });
}

function notifyCustomer(
  paymentId: string,
  invoiceId: string,
  customerId: string,
) {
  return sendCustomerPushNotification(
    customerId,
    "Pembayaran Dibatalkan",
    "Pembayaran Anda telah dibatalkan oleh Admin.",
    { paymentId, invoiceId, action: "CANCEL" },
  );
}
