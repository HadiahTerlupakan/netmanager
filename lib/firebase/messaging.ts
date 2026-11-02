import type { BatchResponse } from "firebase-admin/messaging";
import { logger } from "@/lib/logger";
import { messaging } from "@/lib/firebase/admin";
import { getPushCollapseKey } from "@/lib/firebase/push-collapse";
import { prisma } from "@/lib/prisma";
import { PUSH_SOUND_ANDROID, PUSH_SOUND_IOS } from "@/lib/push-sound";
import { prismaMitra } from "@/lib/prisma-mitra";
import { clearStaleFcmTokens } from "@/modules/notification";

/**
 * Channel Android bernada gelembung. Aplikasi membuatnya setiap kali dibuka dan
 * menjadikannya channel bawaan FCM di manifest; perangkat yang belum punya
 * channel ini jatuh ke channel bawaan manifest itu, menurut dokumentasi FCM.
 */
const ANDROID_NOTIFICATION_CHANNEL_ID = "high-priority-bubble";

/**
 * Galat FCM yang berarti token itu sendiri mati: aplikasi dicopot, token
 * diganti, atau token rusak. `messaging/invalid-argument` tidak termasuk:
 * FCM juga memakainya untuk payload yang salah, dan menganggapnya token mati
 * akan mengosongkan token semua penerima karena satu bug payload.
 */
const STALE_TOKEN_ERROR_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

/**
 * Mendapatkan semua token FCM dari pengguna dengan role Admin (Backend).
 * Wajib filter `tenantId` untuk mencegah cross-tenant notification leak —
 * notifikasi tenant A tidak boleh dipush ke admin tenant B.
 *
 * Token tidak disaring berdasarkan umur: `pushTokenUpdatedAt` hanya
 * diperbarui saat registrasi token Expo lama, jadi menyaring dengannya
 * melewati token FCM admin yang masih hidup. Token mati dibersihkan saat
 * FCM menolaknya (`reapRejectedTokens`).
 */
export async function getAdminTokens(tenantId: string): Promise<string[]> {
  if (!tenantId) {
    logger.error(
      "[FCM] getAdminTokens dipanggil tanpa tenantId — abort untuk cegah cross-tenant leak",
    );
    return [];
  }

  try {
    const admins = await prisma.user.findMany({
      where: {
        role: { accessAdminPanel: true },
        isActive: true,
        tenantId,
      },
      select: { fcmTokens: true },
    });
    return admins.flatMap((admin) => admin.fcmTokens ?? []);
  } catch (error) {
    logger.error("Error fetching admin FCM tokens:", error);
    return [];
  }
}

/**
 * Mendapatkan semua token FCM dari satu user Mitra spesifik
 */
export async function getMitraTokens(mitraId: string): Promise<string[]> {
  try {
    const mitra = await prismaMitra.mitra.findUnique({
      where: { id: mitraId },
    });
    return mitra?.fcmTokens || [];
  } catch (e) {
    logger.error("Error fetching mitra FCM tokens:", e);
    return [];
  }
}

/**
 * Token FCM karyawan aktif dari daftar id — semua perangkat tempat ia login.
 * Id berasal dari baris yang sudah tersaring tenant (mis. peserta chat).
 */
export async function getUserFcmTokens(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, isActive: true },
      select: { fcmTokens: true },
    });
    return users.flatMap((user) => user.fcmTokens ?? []);
  } catch (error) {
    logger.error("Error fetching user FCM tokens:", error);
    return [];
  }
}

/** Token FCM beberapa mitra sekaligus (database mitra). */
export async function getMitraFcmTokens(mitraIds: string[]): Promise<string[]> {
  if (mitraIds.length === 0) return [];
  try {
    const mitras = await prismaMitra.mitra.findMany({
      where: { id: { in: mitraIds } },
      select: { fcmTokens: true },
    });
    return mitras.flatMap((mitra) => mitra.fcmTokens ?? []);
  } catch (error) {
    logger.error("Error fetching mitra FCM tokens:", error);
    return [];
  }
}

/**
 * Mengirim notifikasi multicast FCM ke daftar token dan mengembalikan jumlah
 * pesan yang diterima FCM. Token yang ditolak sebagai tidak terdaftar atau
 * tidak sah dibersihkan dari DB agar tidak terus consume quota di multicast
 * berikutnya.
 */
export async function sendFCMNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<number> {
  if (!tokens || tokens.length === 0) return 0;

  // Guard env tanpa Firebase Admin (dev/CI tanpa secret) — caller umumnya
  // fire-and-forget, tanpa null check ini setiap notifikasi log noisy stack.
  if (!messaging) {
    logger.warn(
      "[FCM] Skip multicast — Firebase Admin SDK tidak ter-init (env tanpa FIREBASE_PRIVATE_KEY?)",
    );
    return 0;
  }

  // Dipakai sebagai collapse key, tag baki, dan apns-collapse-id: push
  // kategori yang sama saling menggantikan selama ponsel offline.
  const collapseKey = getPushCollapseKey(data);

  try {
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title,
        body,
      },
      data: data || {},
      apns: {
        headers: { "apns-collapse-id": collapseKey },
        payload: {
          // iOS menyebut nada di payload, lengkap dengan ekstensinya. Berkasnya
          // dikirim bersama aplikasi; pemasangan lama yang belum memilikinya
          // jatuh kembali ke bunyi bawaan, tidak ada notifikasi yang hilang.
          aps: { sound: PUSH_SOUND_IOS },
        },
      },
      android: {
        priority: "high",
        collapseKey,
        // Android merujuk berkas di res/raw tanpa ekstensi. Nilai ini hanya
        // berlaku pada perangkat pra-Android 8 — sejak Android 8 suara
        // ditentukan channel, yaitu `channelId` bernada lembut ini.
        notification: {
          channelId: ANDROID_NOTIFICATION_CHANNEL_ID,
          sound: PUSH_SOUND_ANDROID,
          tag: collapseKey,
        },
      },
      webpush: {
        notification: {
          icon: "/icon-192x192.png",
        },
      },
    });

    logger.info(
      `[FCM] Multicast sent: ${response.successCount} success, ${response.failureCount} failed.`,
    );

    // Reap stale tokens — devices yang uninstall app, token rotated, atau
    // tidak lagi aktif. Tanpa cleanup, array `fcmTokens[]` membengkak dan
    // multicast berikutnya buang quota ke endpoint mati.
    if (response.failureCount > 0) {
      await reapRejectedTokens(response.responses, tokens);
    }
    return response.successCount;
  } catch (error) {
    logger.error("[FCM] Error sending Multicast:", error);
    return 0;
  }
}

/** Bersihkan token yang ditolak FCM sebagai mati; galat lain hanya dicatat. */
async function reapRejectedTokens(
  responses: BatchResponse["responses"],
  tokens: string[],
): Promise<void> {
  const stale: string[] = [];
  const transientErrorCodes: string[] = [];

  responses.forEach((result, index) => {
    if (result.success) return;
    const errorCode = result.error?.code || "unknown";
    if (STALE_TOKEN_ERROR_CODES.has(errorCode)) {
      stale.push(tokens[index]);
    } else {
      transientErrorCodes.push(errorCode);
    }
  });

  if (transientErrorCodes.length > 0) {
    logger.warn(
      `[FCM] ${transientErrorCodes.length} transient error(s): ${transientErrorCodes.join(", ")}`,
    );
  }
  if (stale.length === 0) return;

  try {
    await clearStaleFcmTokens(stale);
    logger.info(`[FCM] Cleaned ${stale.length} stale token(s) from DB`);
  } catch (cleanupError) {
    logger.warn(
      "[FCM] Failed to clean stale tokens (non-fatal):",
      cleanupError,
    );
  }
}
