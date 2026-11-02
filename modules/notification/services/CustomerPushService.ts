import { sendFCMNotification } from "@/lib/firebase/messaging";
import { logger } from "@/lib/logger";
import { toFcmData } from "./fcm-data";
import { PelangganPushTokenService } from "@/modules/pelanggan";

let pelangganPushTokenService: PelangganPushTokenService | null = null;

function getPelangganPushTokenService(): PelangganPushTokenService {
  pelangganPushTokenService ??= new PelangganPushTokenService();
  return pelangganPushTokenService;
}

/**
 * Kirim push ke satu pelanggan lewat FCM ke setiap perangkat aplikasi
 * (`fcmTokens`, didaftarkan sejak 2026-04-16). Mengembalikan true bila FCM
 * menerima setidaknya satu perangkat.
 *
 * Preferensi ditegakkan di sini, bukan di tiap pemanggil: jalur push langsung
 * (pembayaran ditolak/dibatalkan) dulu melewatinya sehingga pelanggan yang
 * sudah mematikan notifikasi tagihan tetap menerima push.
 */
export async function sendCustomerPushNotification(
  pelangganId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<boolean> {
  try {
    const pelanggan =
      await getPelangganPushTokenService().findByIdWithPushToken(pelangganId);
    if (!pelanggan) return false;
    if (pelanggan.isBillNotifEnabled === false) {
      logger.info(
        `[Push] Skip — pelanggan ${pelangganId} menonaktifkan notifikasi tagihan`,
      );
      return false;
    }

    return await sendCustomerFcm(pelanggan.fcmTokens, title, body, data);
  } catch (error) {
    logger.error("[Push] Error sending customer notification:", error);
    return false;
  }
}

async function sendCustomerFcm(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<boolean> {
  if (tokens.length === 0) return false;
  const accepted = await sendFCMNotification(
    tokens,
    title,
    body,
    toFcmData(data),
  );
  return accepted > 0;
}
