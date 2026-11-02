const NOTIFICATION_ICON_SRC = "/icon-192x192.png";

function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Meminta izin notifikasi browser bila belum pernah ditanya.
 * Wajib dipanggil dari aksi pengguna (klik/kirim): browser memblokir
 * permintaan izin yang muncul tanpa interaksi.
 */
export function requestNotificationPermissionOnGesture(): void {
  if (!isNotificationSupported()) return;
  if (Notification.permission !== "default") return;
  void Notification.requestPermission();
}

/** Menampilkan notifikasi browser untuk pesan chat baru (bila diizinkan). */
export function showChatBrowserNotification(
  senderName: string,
  content: string,
): void {
  if (!isNotificationSupported()) return;
  if (Notification.permission !== "granted") return;
  new Notification(`Pesan baru dari ${senderName}`, {
    body: content,
    icon: NOTIFICATION_ICON_SRC,
  });
}
