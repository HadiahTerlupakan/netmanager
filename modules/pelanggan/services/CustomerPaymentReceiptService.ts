import { logger } from "@/lib/logger";
import { firebaseRealtimeService } from "@/lib/realtime";
import { getAdminTokens, sendFCMNotification } from "@/lib/firebase/messaging";
import { analyzeReceiptWithOCR } from "@/modules/integrations";
import { convertAndSaveImage } from "@/lib/utils/image-upload";
import {
  findPendingManualCustomerTransfer,
  updateCustomerPaymentReceipt,
} from "@/modules/finance";
import { PelangganRepository } from "../repositories/PelangganRepository";

type ReceiptUploadOptions = {
  invoiceId: string;
  file: File;
  customerId: string;
  customerCode?: string | null;
};

type ReceiptUploadResult =
  | { status: "not-found" }
  | { status: "uploaded"; receiptUrl: string };

const RECEIPT_NOTIFICATION_TITLE = "Persetujuan Pembayaran";
const RECEIPT_NOTIFICATION_MESSAGE = "Struk pembayaran baru diunggah pelanggan";
const RECEIPT_NOTIFICATION_URL = "/admin/payments/approval";

const pelangganRepository = new PelangganRepository();

/** Stores customer payment receipt and publishes admin realtime notification. */
export async function uploadCustomerPaymentReceipt(
  options: ReceiptUploadOptions,
): Promise<ReceiptUploadResult> {
  const payment = await findReceiptPayment(options);
  if (!payment) return handleMissingReceiptPayment(options);

  const receiptUrl = await saveReceiptImage(options, payment.id);
  const updatedPayment = await updateCustomerPaymentReceipt({
    paymentId: payment.id,
    receiptUrl,
    notes: await buildPaymentReceiptNotes(options.file, payment),
  });

  await publishReceiptUploadSideEffects(
    options.customerId,
    updatedPayment.id,
    Number(payment.amount),
    Reflect.get(payment, "tenantId") as string | null | undefined,
  );
  return {
    status: "uploaded",
    receiptUrl: updatedPayment.receiptUrl ?? receiptUrl,
  };
}

function findReceiptPayment(options: ReceiptUploadOptions) {
  return findPendingManualCustomerTransfer({
    invoiceId: options.invoiceId,
    customerId: options.customerId,
  });
}

function handleMissingReceiptPayment(
  options: ReceiptUploadOptions,
): ReceiptUploadResult {
  logger.error(
    `[upload-receipt] FAIL: No pending BANK_TRANSFER found. invoiceId: ${options.invoiceId}, pelangganId: ${options.customerCode}`,
  );
  return { status: "not-found" };
}

async function saveReceiptImage(
  options: ReceiptUploadOptions,
  paymentId: string,
) {
  return convertAndSaveImage(
    options.file,
    "public/receipts",
    `receipt_${paymentId}_${Date.now()}`,
    "payment-proofs",
    `pelanggan_${options.customerId}`,
  );
}

async function buildPaymentReceiptNotes(
  file: File,
  payment: NonNullable<Awaited<ReturnType<typeof findReceiptPayment>>>,
) {
  return buildReceiptNotes(
    payment.notes,
    Number(payment.amount),
    file,
    Reflect.get(payment, "tenantId") as string | null | undefined,
  );
}

async function publishReceiptUploadSideEffects(
  customerId: string,
  paymentId: string,
  amount: number,
  tenantId: string | null | undefined,
) {
  await publishPaymentUploadNotification({ customerId, paymentId, amount });
  await notifyAdminsAboutReceiptUpload(tenantId);
}

async function buildReceiptNotes(
  existingNotes: string | null,
  expectedAmount: number,
  file: File,
  tenantId?: string | null,
) {
  const ocrResult = await analyzeReceiptWithOCR(
    await file.arrayBuffer(),
    file.type,
    tenantId,
  );
  let notes = existingNotes ? `${existingNotes}\n---\n` : "";

  if (ocrResult.is_potentially_fake) {
    return `${notes}⚠️ [AI Peringatan] Terindikasi palsu/editan. ${ocrResult.catatan_analisis}`.trim();
  }

  if (!ocrResult.is_valid_receipt) {
    return `${notes}⚠️ [AI Peringatan] Bukan gambar struk transfer/E-Wallet yang valid. ${ocrResult.catatan_analisis}`.trim();
  }

  const warnings = buildAmountWarnings(ocrResult.nominal, expectedAmount);
  const statusText =
    warnings.length > 0
      ? `⚠️ [AI Peringatan] ${warnings.join(", ")}.`
      : `✅ [AI Validasi] Nominal sesuai (Rp${expectedAmount.toLocaleString("id-ID")}).`;

  notes += `${statusText} ${ocrResult.catatan_analisis}`;
  return notes.trim();
}

function buildAmountWarnings(nominal: number | null, expectedAmount: number) {
  if (!nominal) {
    return ["Nominal tidak terbaca"];
  }

  if (nominal !== expectedAmount) {
    return [
      `Nominal di struk (Rp${nominal.toLocaleString("id-ID")}) BEDA dengan tagihan (Rp${expectedAmount.toLocaleString("id-ID")})`,
    ];
  }

  return [];
}

type PaymentUploadNotification = {
  customerId: string;
  paymentId: string;
  amount: number;
};

/** Mempublikasikan event realtime admin setelah bukti pembayaran masuk. */
async function publishPaymentUploadNotification(
  options: PaymentUploadNotification,
) {
  const scopeIds = await getReceiptNotificationScopes(options.customerId);
  const payload = buildReceiptNotificationPayload(options);
  void publishReceiptNotificationScopes(scopeIds, payload);
}

async function getReceiptNotificationScopes(customerId: string) {
  const pelanggan = await pelangganRepository.findById(customerId);
  return pelanggan?.siteId
    ? [`notifications.site.${pelanggan.siteId}`, "notifications"]
    : ["notifications"];
}

function buildReceiptNotificationPayload(options: PaymentUploadNotification) {
  return {
    id: options.paymentId,
    amount: options.amount,
    pelangganId: options.customerId,
    message: "Struk pembayaran baru diunggah",
  };
}

async function publishReceiptNotificationScopes(
  scopeIds: string[],
  payload: ReturnType<typeof buildReceiptNotificationPayload>,
) {
  await Promise.all(
    scopeIds.map((notificationScopeId) =>
      firebaseRealtimeService.publish({
        type: "payment.pending.new",
        scope: { kind: "admin", id: notificationScopeId },
        payload,
      }),
    ),
  ).catch((error) => {
    logger.error("[upload-receipt] Failed to publish realtime update", error);
  });
}

/** Mengirim push notification admin setelah pelanggan mengunggah bukti pembayaran. */
async function notifyAdminsAboutReceiptUpload(
  tenantId: string | null | undefined,
) {
  if (!tenantId) {
    logger.warn(
      "[FCM] Skip push admin — payment tanpa tenantId, tidak bisa target tenant scope",
    );
    return;
  }

  try {
    const tokens = await getAdminTokens(tenantId);
    await sendFCMNotification(
      tokens,
      RECEIPT_NOTIFICATION_TITLE,
      RECEIPT_NOTIFICATION_MESSAGE,
      { url: RECEIPT_NOTIFICATION_URL },
    );
  } catch (error) {
    logger.error("[FCM] Push failed", error);
  }
}
