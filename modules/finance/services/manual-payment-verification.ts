import { createRouteServiceError } from "@/lib/api/route-service-error";
import { logger } from "@/lib/logger";
import { BillingEventDispatcher } from "@/modules/events";
import {
  CUSTOMER_APP_BILLING_ROUTE,
  sendCustomerPushNotification,
} from "@/modules/notification";
import {
  claimPendingCheckout,
  findPendingCheckoutPayments,
  findSettledPayments,
  type VerifiablePayment,
} from "../repositories/manualPaymentVerification.repository";
import { InvoiceStatus } from "../types/invoice.enums";
import { settleReceivedPayments } from "./received-payment-settlement";

const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
export const PAYMENT_NOT_FOUND_MESSAGE =
  "Payment not found or already processed";
const CHECKOUT_CHANGED_MESSAGE =
  "Transfer ini baru saja dibatalkan pelanggan atau diproses admin lain. Muat ulang daftar verifikasi.";

const formatRupiah = (amount: bigint) =>
  `Rp ${Number(amount).toLocaleString("id-ID")}`;

/** Hasil verifikasi untuk admin; `warnings` menjelaskan uang yang tidak melunasi tagihannya sendiri. */
export type ManualVerificationResult = {
  success: true;
  message: string;
  warnings: string[];
};

/**
 * Transfer manual ke rekening perusahaan, dikenali dari rekening tujuannya
 * (`accountId`) seperti di sisi checkout pelanggan; payment VA kini juga
 * BANK_TRANSFER, jadi metode pembayaran tidak bisa dipakai. Checkout gateway
 * hanya boleh dilunasi oleh webhook atau cek status gateway: tanpa
 * pemeriksaan ini admin bisa "menyetujui" VA yang belum dibayar lewat id
 * payment-nya.
 */
export function isManualTransferPayment(payment: {
  accountId: string | null;
}): boolean {
  return payment.accountId !== null;
}

/**
 * Setujui bukti transfer untuk seluruh checkout-nya, lalu lunasi lewat jalur
 * yang sama dengan webhook gateway: tagihan yang sudah lunas atau dibatalkan
 * tidak dilunasi dua kali; uangnya ke tagihan pengganti atau saldo kredit, dan
 * admin menerima penjelasannya di `warnings`. Pembatalan pelanggan atau
 * keputusan admin lain yang lebih dulu commit membuatnya gagal dengan 409.
 */
export async function approveManualCheckout(
  payment: VerifiablePayment,
  options: { notes?: string | null; verifiedBy?: string | null },
): Promise<ManualVerificationResult> {
  const checkout = await findPendingCheckout(payment);
  const now = new Date();
  await claimWholeCheckout(
    checkout,
    {
      gatewayStatus: "PAID",
      paymentDate: now,
      verifiedAt: now,
      verifiedBy: options.verifiedBy ?? null,
    },
    options.notes
      ? (pending) => appendNote(pending.notes, options.notes)
      : undefined,
  );

  await settleReceivedPayments(checkout);
  const settled = await findSettledPayments(checkout.map((p) => p.id));
  await notifyRemainingBalance(checkout, settled);

  return {
    success: true,
    message: "Payment approved",
    warnings: describeSettlement(checkout, settled),
  };
}

/**
 * Tolak bukti transfer untuk seluruh checkout-nya, atau gagal dengan 409 bila
 * checkout itu berubah lebih dulu. Alasan admin disimpan di
 * `rejectionReason`, terpisah dari `notes` yang memuat analisis OCR, lalu
 * dikirim ke pelanggan lewat notifikasi tagihan (in-app, push, WhatsApp/email
 * sesuai pengaturannya). Pemesanan kupon checkout dikembalikan sekali supaya
 * pelanggan bisa memakainya lagi, kecuali yang masih dipegang payment lain
 * yang hidup (mis. invoice Rp 0 yang tertutup kupon itu).
 */
export async function rejectManualCheckout(
  payment: VerifiablePayment,
  options: { reason?: string | null; verifiedBy?: string | null },
): Promise<ManualVerificationResult> {
  const checkout = await findPendingCheckout(payment);
  const reason = options.reason?.trim() || null;
  await claimWholeCheckout(checkout, {
    gatewayStatus: "FAILED",
    verifiedAt: new Date(),
    verifiedBy: options.verifiedBy ?? null,
    rejectionReason: reason,
  });

  const { releaseUnusedCheckoutCoupons } =
    await import("@/modules/payment-gateway");
  await releaseUnusedCheckoutCoupons(checkout);
  await notifyRejection(payment, checkout, reason);
  return { success: true, message: "Payment rejected", warnings: [] };
}

async function findPendingCheckout(payment: VerifiablePayment) {
  const checkout = await findPendingCheckoutPayments(payment);
  if (checkout.length === 0) {
    throw createRouteServiceError(PAYMENT_NOT_FOUND_MESSAGE, HTTP_NOT_FOUND);
  }
  return checkout;
}

async function claimWholeCheckout(
  ...claim: Parameters<typeof claimPendingCheckout>
) {
  if (!(await claimPendingCheckout(...claim))) {
    throw createRouteServiceError(CHECKOUT_CHANGED_MESSAGE, HTTP_CONFLICT);
  }
}

/**
 * Penolakannya sudah tersimpan saat ini dipanggil; pemberitahuan yang gagal
 * dicatat saja, supaya admin tidak melihat galat untuk penolakan yang berhasil
 * lalu mencoba lagi dan mendapat "sudah diproses".
 */
async function notifyRejection(
  payment: VerifiablePayment,
  rejected: VerifiablePayment[],
  reason: string | null,
) {
  const invoiceId = rejected.find((p) => p.invoiceId)?.invoiceId;
  if (!invoiceId) return;
  try {
    await BillingEventDispatcher.onPaymentRejected({
      invoiceId,
      pelangganId: payment.pelangganId,
      amount: Number(rejected.reduce((sum, p) => sum + p.amount, 0n)),
      invoiceNumbers: rejected.flatMap((p) =>
        p.invoice ? [p.invoice.invoiceNumber] : [],
      ),
      reason: reason ?? undefined,
      tenantId: payment.tenantId ?? undefined,
    });
  } catch (error) {
    logger.error(
      `[VerifikasiTransfer] Pemberitahuan penolakan untuk invoice ${invoiceId} gagal dikirim`,
      error instanceof Error ? error : undefined,
    );
  }
}

function appendNote(existing: string | null, note: string | null | undefined) {
  if (!note) return existing;
  return existing ? `${existing}\nCatatan verifikasi: ${note}` : note;
}

type SettledPayment = Awaited<ReturnType<typeof findSettledPayments>>[number];

/** Penjelasan untuk admin bila uang tidak (seluruhnya) melunasi tagihannya. */
function describeSettlement(
  approved: VerifiablePayment[],
  settled: SettledPayment[],
): string[] {
  return approved.flatMap((before) => {
    const after = settled.find((p) => p.id === before.id);
    const original = before.invoice?.invoiceNumber ?? "-";
    const credited = after?.kelebihanBayar ?? 0n;
    const toSaldo = `${formatRupiah(credited)} dikreditkan ke saldo kredit pelanggan`;
    if (after && after.invoiceId !== before.invoiceId) {
      return [
        `Tagihan ${original} sudah dibatalkan; pembayarannya dipakai untuk tagihan pengganti ${after.invoice?.invoiceNumber ?? "-"}${credited > 0n ? `, dan ${toSaldo}` : ""}.`,
      ];
    }
    if (credited <= 0n) return [];
    const reason =
      after?.invoice?.status === InvoiceStatus.CANCELLED
        ? "sudah dibatalkan"
        : "sudah lunas";
    return [`Tagihan ${original} ${reason}; ${toSaldo}.`];
  });
}

/**
 * Tagihan yang jadi lunas sudah diberitahukan lewat INVOICE_PAID (in-app,
 * push, WhatsApp, email); push langsung di sini membuat pelanggan menerima
 * dua push. Yang tersisa hanya tagihan yang masih dibayar sebagian.
 */
async function notifyRemainingBalance(
  approved: VerifiablePayment[],
  settled: SettledPayment[],
) {
  const partial = settled.filter(
    (p) => p.invoice?.status === InvoiceStatus.PARTIAL_PAID,
  );
  for (const payment of partial) {
    const owner = approved.find((p) => p.id === payment.id);
    if (!owner) continue;
    await sendCustomerPushNotification(
      owner.pelangganId,
      "Pembayaran Diterima",
      "Pembayaran Anda sudah kami terima. Sisa tagihan masih perlu dilunasi.",
      {
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        action: "APPROVE",
        url: CUSTOMER_APP_BILLING_ROUTE,
      },
    );
  }
}
