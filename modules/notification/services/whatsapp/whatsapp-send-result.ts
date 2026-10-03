import type { SendResult } from "./whatsapp-provider-interface";

/** Hasil kirim saat tenant belum punya akun WhatsApp aktif (belum di-pair). */
export const NO_ACCOUNT_RESULT: Readonly<SendResult> = {
  success: false,
  error: "Tidak ada akun WhatsApp yang tersedia",
  errorCode: "NO_ACCOUNT_CONFIGURED",
};

/** True jika pengiriman dilewati karena tenant belum punya akun WhatsApp aktif. */
export function isWhatsAppNotConfigured(result: SendResult): boolean {
  return result.errorCode === "NO_ACCOUNT_CONFIGURED";
}
