import { logger } from "@/lib/logger";
import { firebaseRealtimeService } from "@/lib/realtime";
import { getAdminTokens, sendFCMNotification } from "@/lib/firebase/messaging";
import { buildTenantUploadDir } from "@/lib/upload/upload-policy";
import {
  validateFileSignature,
  validateFileSize,
  type AllowedFileType,
} from "@/lib/utils/file-validation";
import { analyzeReceiptWithOCR } from "@/modules/integrations";
import { convertAndSaveImage } from "@/lib/utils/image-upload";
import {
  attachCustomerCheckoutReceipt,
  findPendingManualCustomerCheckout,
} from "@/modules/finance";
import { PelangganRepository } from "../repositories/PelangganRepository";

type ReceiptUploadOptions = {
  invoiceId: string;
  file: File;
  customerId: string;
  customerCode?: string | null;
  /** Tenant sesi, dipakai bila payment lama tidak mencatat tenantnya. */
  tenantId?: string | null;
};

type ReceiptUploadResult =
  | { status: "not-found" }
  | { status: "invalid-file"; message: string }
  | { status: "uploaded"; receiptUrl: string };

type CheckoutPayment = Awaited<
  ReturnType<typeof findPendingManualCustomerCheckout>
>[number];

const RECEIPT_NOTIFICATION_TITLE = "Persetujuan Pembayaran";
const RECEIPT_NOTIFICATION_MESSAGE = "Struk pembayaran baru diunggah pelanggan";
const RECEIPT_NOTIFICATION_URL = "/admin/payments/approval";
// Di bawah `public/uploads/`, yang hanya disajikan `server.ts` kepada sesi
// yang berhak; `public/receipts` dulu terbuka untuk siapa saja yang tahu URL.
const RECEIPT_UPLOAD_DIR = "public/uploads/payment-proofs";
const RECEIPT_STORAGE_CATEGORY = "payment-proofs";
const INVALID_IMAGE_MESSAGE = "File harus berupa gambar JPG, PNG, atau WebP";
const OVERSIZED_IMAGE_MESSAGE = "Ukuran file maksimal 5MB";
const MISSING_TENANT_MESSAGE =
  "Pembayaran tanpa tenant tidak bisa menyimpan bukti transfer";
const NOTE_SEPARATOR = "\n---\n";
const AI_WARNING_PREFIX = "⚠️ [AI Peringatan]";
const AI_VALID_PREFIX = "✅ [AI Validasi]";

// Jenis gambar ditentukan dari isi berkas, bukan MIME kiriman klien.
const RECEIPT_IMAGE_TYPES: Array<[AllowedFileType, string]> = [
  ["jpg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
];

const pelangganRepository = new PelangganRepository();

/**
 * Simpan bukti transfer untuk checkout transfer manual yang memuat invoice
 * ini, dilampirkan ke setiap invoice checkout-nya. Bukti boleh diganti selama
 * checkout masih menunggu verifikasi.
 */
export async function uploadCustomerPaymentReceipt(
  options: ReceiptUploadOptions,
): Promise<ReceiptUploadResult> {
  const mimeType = await detectReceiptImageType(options.file);
  if (!mimeType) {
    return { status: "invalid-file", message: INVALID_IMAGE_MESSAGE };
  }
  if (!validateFileSize(options.file)) {
    return { status: "invalid-file", message: OVERSIZED_IMAGE_MESSAGE };
  }

  const checkout = await findPendingManualCustomerCheckout(options);
  if (checkout.length === 0) return handleMissingReceiptPayment(options);

  const tenantId = checkout[0].tenantId ?? options.tenantId;
  if (!tenantId) throw new Error(MISSING_TENANT_MESSAGE);

  const receiptUrl = await saveReceiptImage(options, checkout[0], tenantId);
  const expectedAmount = Number(
    checkout.reduce((sum, payment) => sum + payment.amount, 0n),
  );
  const analysis = await analyzeReceipt(
    options.file,
    mimeType,
    expectedAmount,
    tenantId,
  );
  const attached = await attachCustomerCheckoutReceipt({
    receiptUrl,
    payments: checkout.map((payment) => ({
      id: payment.id,
      notes: replaceAnalysisNote(payment.notes, analysis),
    })),
  });
  // Admin menyetujui atau pelanggan membatalkan di antara kedua langkah.
  if (attached === 0) return handleMissingReceiptPayment(options);

  await publishReceiptUploadSideEffects(
    options.customerId,
    checkout[0].id,
    expectedAmount,
    tenantId,
  );
  return { status: "uploaded", receiptUrl };
}

async function detectReceiptImageType(file: File) {
  for (const [signature, mimeType] of RECEIPT_IMAGE_TYPES) {
    if (await validateFileSignature(file, [signature])) return mimeType;
  }
  return null;
}

function handleMissingReceiptPayment(
  options: ReceiptUploadOptions,
): ReceiptUploadResult {
  logger.error(
    `[upload-receipt] FAIL: No pending manual transfer found. invoiceId: ${options.invoiceId}, pelangganId: ${options.customerCode}`,
  );
  return { status: "not-found" };
}

function saveReceiptImage(
  options: ReceiptUploadOptions,
  payment: CheckoutPayment,
  tenantId: string,
) {
  return convertAndSaveImage(
    options.file,
    buildTenantUploadDir(RECEIPT_UPLOAD_DIR, tenantId),
    `receipt_${payment.checkoutId ?? payment.id}_${Date.now()}`,
    RECEIPT_STORAGE_CATEGORY,
  );
}

/**
 * Analisis OCR menggambarkan satu bukti. Bukti yang diganti membawa
 * analisisnya sendiri, jadi analisis bukti lama dibuang, bukan ditumpuk di
 * bawah catatan pelanggan.
 */
function replaceAnalysisNote(existingNotes: string | null, analysis: string) {
  const kept = (existingNotes ?? "")
    .split(NOTE_SEPARATOR)
    .filter((note) => note && !isAnalysisNote(note));
  return [...kept, analysis].join(NOTE_SEPARATOR);
}

function isAnalysisNote(note: string) {
  return note.startsWith(AI_WARNING_PREFIX) || note.startsWith(AI_VALID_PREFIX);
}

async function publishReceiptUploadSideEffects(
  customerId: string,
  paymentId: string,
  amount: number,
  tenantId: string,
) {
  await publishPaymentUploadNotification({ customerId, paymentId, amount });
  await notifyAdminsAboutReceiptUpload(tenantId);
}

/** Catatan verifikasi otomatis (OCR) untuk admin, satu kali per bukti. */
async function analyzeReceipt(
  file: File,
  mimeType: string,
  expectedAmount: number,
  tenantId: string,
) {
  const ocrResult = await analyzeReceiptWithOCR(
    await file.arrayBuffer(),
    mimeType,
    tenantId,
  );

  if (ocrResult.is_potentially_fake) {
    return `${AI_WARNING_PREFIX} Terindikasi palsu/editan. ${ocrResult.catatan_analisis}`.trim();
  }

  if (!ocrResult.is_valid_receipt) {
    return `${AI_WARNING_PREFIX} Bukan gambar struk transfer/E-Wallet yang valid. ${ocrResult.catatan_analisis}`.trim();
  }

  const warnings = buildAmountWarnings(ocrResult.nominal, expectedAmount);
  const statusText =
    warnings.length > 0
      ? `${AI_WARNING_PREFIX} ${warnings.join(", ")}.`
      : `${AI_VALID_PREFIX} Nominal sesuai (Rp${expectedAmount.toLocaleString("id-ID")}).`;

  return `${statusText} ${ocrResult.catatan_analisis}`.trim();
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
async function notifyAdminsAboutReceiptUpload(tenantId: string) {
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
