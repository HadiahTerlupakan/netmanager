import { logger } from "@/lib/logger";
import { firebaseRealtimeService } from "@/lib/realtime";
import { analyzeReceiptWithOCR } from "@/lib/services/receipt-ocr";
import { convertAndSaveImage } from "@/lib/utils/image-upload";
import {
  findPendingManualCustomerTransfer,
  updateCustomerPaymentReceipt,
} from "@/modules/finance";
import { PelangganRepository } from "../repositories/PelangganRepository";

type ReceiptUploadResult =
  | { status: "not-found" }
  | { status: "uploaded"; receiptUrl: string };

const pelangganRepository = new PelangganRepository();

/** Stores customer payment receipt and publishes admin realtime notification. */
export async function uploadCustomerPaymentReceipt(options: {
  invoiceId: string;
  file: File;
  customerId: string;
  customerCode?: string | null;
}): Promise<ReceiptUploadResult> {
  const payment = await findPendingManualCustomerTransfer({
    invoiceId: options.invoiceId,
    customerId: options.customerId,
  });

  if (!payment) {
    logger.error(
      `[upload-receipt] FAIL: No pending BANK_TRANSFER found. invoiceId: ${options.invoiceId}, pelangganId: ${options.customerCode}`,
    );
    return { status: "not-found" };
  }

  const notes = await buildReceiptNotes(
    payment.notes,
    Number(payment.amount),
    options.file,
    Reflect.get(payment, "tenantId") as string | null | undefined,
  );
  const receiptUrl = await convertAndSaveImage(
    options.file,
    "public/receipts",
    `receipt_${payment.id}_${Date.now()}`,
    "payment-proofs",
    `pelanggan_${options.customerId}`,
  );
  const updatedPayment = await updateCustomerPaymentReceipt({
    paymentId: payment.id,
    receiptUrl,
    notes,
  });

  await publishPaymentUploadNotification({
    customerId: options.customerId,
    paymentId: updatedPayment.id,
    amount: Number(payment.amount),
  });

  return {
    status: "uploaded",
    receiptUrl: updatedPayment.receiptUrl ?? receiptUrl,
  };
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

async function publishPaymentUploadNotification(options: {
  customerId: string;
  paymentId: string;
  amount: number;
}) {
  const pelanggan = await pelangganRepository.findById(options.customerId);
  const scopeIds = pelanggan?.siteId
    ? [`notifications.site.${pelanggan.siteId}`, "notifications"]
    : ["notifications"];
  const payload = {
    id: options.paymentId,
    amount: options.amount,
    pelangganId: options.customerId,
    message: "Struk pembayaran baru diunggah",
  };

  void Promise.all(
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
