import { clientLogger } from "@/lib/client-logger";

/**
 * Nada notifikasi bawaan untuk admin dan portal pelanggan. Berkasnya sama
 * dengan nada aplikasi mobile (`assets/sounds/notif_soft.wav` di repo
 * mobile-netmanager, disintesis oleh `scripts/generate-notification-sound.py`
 * di sana), supaya satu notifikasi terdengar sama di mana pun.
 */
export const NOTIFICATION_SOUND_SRC = "/sounds/notification.wav";

const CUSTOMER_SOUND_PREFERENCE_KEY = "customer_notification_sound";

/** Pelanggan mendengar nada kecuali mematikannya di halaman Profil. */
export function isCustomerNotificationSoundEnabled(): boolean {
  try {
    return localStorage.getItem(CUSTOMER_SOUND_PREFERENCE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setCustomerNotificationSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(CUSTOMER_SOUND_PREFERENCE_KEY, String(enabled));
  } catch {
    // Penyimpanan diblokir (mode privat): pilihannya tidak bisa diingat.
  }
}

/**
 * Browser menolak memutar suara sebelum pengguna berinteraksi dengan halaman;
 * penolakan itu wajar dan tidak boleh muncul sebagai galat.
 */
export function playCustomerNotificationSound(): void {
  if (!isCustomerNotificationSoundEnabled()) return;
  try {
    void new Audio(NOTIFICATION_SOUND_SRC).play().catch((error: unknown) => {
      clientLogger.info("[NotificationSound] Play blocked:", error);
    });
  } catch (error) {
    clientLogger.info("[NotificationSound] Audio unavailable:", error);
  }
}
