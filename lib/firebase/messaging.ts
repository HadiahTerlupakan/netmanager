import { logger } from "@/lib/logger";
import { messaging } from "@/lib/firebase/admin";
import { prisma } from "@/lib/prisma";
import { prismaMitra } from "@/lib/prisma-mitra";
import { clearStaleFcmTokens } from "@/modules/notification";

const STALE_TOKEN_THRESHOLD_DAYS = 30;

/**
 * Mendapatkan semua token FCM dari pengguna dengan role Admin (Backend).
 * Wajib filter `tenantId` untuk mencegah cross-tenant notification leak —
 * notifikasi tenant A tidak boleh dipush ke admin tenant B.
 *
 * Pre-send filtering: skip user yang `pushTokenUpdatedAt` sudah lebih dari
 * 30 hari — kemungkinan token sudah stale (user ganti HP, uninstall, dll).
 * Ini mengurangi wasted API calls ke Firebase.
 */
/**
 * Nada notifikasi yang dikirim bersama aplikasi mobile, menggantikan bunyi
 * bawaan perangkat. Asetnya ada di repo mobile pada
 * `assets/sounds/notif_soft.wav` dan disalin ke kedua platform saat prebuild.
 */
const NOTIFICATION_SOUND_IOS = "notif_soft.wav";
const NOTIFICATION_SOUND_ANDROID = "notif_soft";

export async function getAdminTokens(tenantId: string): Promise<string[]> {
  if (!tenantId) {
    logger.error(
      "[FCM] getAdminTokens dipanggil tanpa tenantId — abort untuk cegah cross-tenant leak",
    );
    return [];
  }

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - STALE_TOKEN_THRESHOLD_DAYS);

    const admins = await prisma.user.findMany({
      where: {
        role: { accessAdminPanel: true },
        isActive: true,
        tenantId,
      },
    });

    const tokens: string[] = [];
    let skippedStale = 0;
    for (const admin of admins) {
      if (admin.fcmTokens && Array.isArray(admin.fcmTokens)) {
        const isStale =
          admin.pushTokenUpdatedAt && admin.pushTokenUpdatedAt < cutoff;
        if (isStale) {
          skippedStale += admin.fcmTokens.length;
          continue;
        }
        tokens.push(...admin.fcmTokens);
      }
    }
    if (skippedStale > 0) {
      logger.info(
        `[FCM] getAdminTokens: skipped ${skippedStale} token(s) from users inactive >${STALE_TOKEN_THRESHOLD_DAYS}d`,
      );
    }
    return tokens;
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
 * Mengirim notifikasi multicast FCM ke daftar token. Token yang ditolak FCM
 * dengan kode `messaging/registration-token-not-registered` akan dibersihkan
 * dari DB agar tidak terus consume quota di multicast berikutnya.
 */
export async function sendFCMNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  if (!tokens || tokens.length === 0) return;

  // Guard env tanpa Firebase Admin (dev/CI tanpa secret) — caller umumnya
  // fire-and-forget, tanpa null check ini setiap notifikasi log noisy stack.
  if (!messaging) {
    logger.warn(
      "[FCM] Skip multicast — Firebase Admin SDK tidak ter-init (env tanpa FIREBASE_PRIVATE_KEY?)",
    );
    return;
  }

  try {
    const response = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title,
        body,
      },
      data: data || {},
      apns: {
        payload: {
          // iOS menyebut nada di payload, lengkap dengan ekstensinya. Berkasnya
          // dikirim bersama aplikasi; pemasangan lama yang belum memilikinya
          // jatuh kembali ke bunyi bawaan, tidak ada notifikasi yang hilang.
          aps: { sound: NOTIFICATION_SOUND_IOS },
        },
      },
      android: {
        priority: "high",
        // Android merujuk berkas di res/raw tanpa ekstensi. Nilai ini hanya
        // berlaku pada perangkat pra-Android 8 — sejak Android 8 suara
        // ditentukan channel, dan aplikasi mengarahkan notifikasi latar
        // belakang ke channel bernada lembut lewat penunjuk di manifest.
        notification: { sound: NOTIFICATION_SOUND_ANDROID },
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
      const stale: string[] = [];
      const transientErrors: Array<{ index: number; code: string }> = [];

      for (let i = 0; i < response.responses.length; i++) {
        const r = response.responses[i];
        if (r.success) continue;
        const errorCode = r.error?.code || "unknown";
        if (errorCode === "messaging/registration-token-not-registered") {
          stale.push(tokens[i]);
        } else {
          transientErrors.push({ index: i, code: errorCode });
        }
      }

      if (transientErrors.length > 0) {
        logger.warn(
          `[FCM] ${transientErrors.length} transient error(s): ${transientErrors.map((e) => e.code).join(", ")}`,
        );
      }

      if (stale.length > 0) {
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
    }
  } catch (error) {
    logger.error("[FCM] Error sending Multicast:", error);
  }
}
