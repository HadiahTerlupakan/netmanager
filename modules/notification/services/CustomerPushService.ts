import { sendFCMNotification } from "@/lib/firebase/messaging";
import { logger } from "@/lib/logger";
import { PelangganPushTokenService } from "@/modules/pelanggan";
import { sendExpoPushToToken } from "./ExpoPushService";

let pelangganPushTokenService: PelangganPushTokenService | null = null;

function getPelangganPushTokenService(): PelangganPushTokenService {
  pelangganPushTokenService ??= new PelangganPushTokenService();
  return pelangganPushTokenService;
}

/**
 * Kirim push ke satu pelanggan: lewat FCM ke setiap perangkat aplikasi sekarang
 * (`fcmTokens`, didaftarkan sejak 2026-04-16) dan lewat Expo ke token aplikasi
 * era Expo (`pushToken`) bila masih ada. Mengembalikan true bila salah satu
 * kanal menerimanya.
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

    // Kanal yang gagal tidak boleh menahan kanal lain.
    const deliveries = await Promise.allSettled([
      sendCustomerFcm(pelanggan.fcmTokens, title, body, data),
      pelanggan.pushToken
        ? sendExpoPushToToken(pelanggan.pushToken, title, body, data)
        : Promise.resolve(false),
    ]);
    return deliveries.some(isDelivered);
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

function isDelivered(delivery: PromiseSettledResult<boolean>): boolean {
  if (delivery.status === "rejected") {
    logger.error("[Push] Customer push channel failed:", delivery.reason);
    return false;
  }
  return delivery.value;
}

/** FCM hanya menerima data bernilai string; nilai kosong dibuang. */
function toFcmData(data: Record<string, unknown> = {}): Record<string, string> {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => [key, toFcmDataValue(value)]),
  );
}

function toFcmDataValue(value: unknown): string {
  if (typeof value === "string") return value;
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
