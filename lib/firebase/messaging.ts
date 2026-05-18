import { logger } from "@/lib/logger";
import { messaging } from "@/lib/firebase/admin";
import { prisma } from "@/lib/prisma";
import { prismaMitra } from "@/lib/prisma-mitra";
import { clearStaleFcmTokens } from "@/modules/notification";

/**
 * Mendapatkan semua token FCM dari pengguna dengan role Admin (Backend).
 * Wajib filter `tenantId` untuk mencegah cross-tenant notification leak —
 * notifikasi tenant A tidak boleh dipush ke admin tenant B.
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
    });

    const tokens: string[] = [];
    for (const admin of admins) {
      if (admin.fcmTokens && Array.isArray(admin.fcmTokens)) {
        tokens.push(...admin.fcmTokens);
      }
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
          aps: { sound: "default" },
        },
      },
      android: {
        priority: "high",
        notification: { sound: "default" },
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
      const stale = response.responses
        .map((r, i) =>
          !r.success &&
          r.error?.code === "messaging/registration-token-not-registered"
            ? tokens[i]
            : null,
        )
        .filter((t): t is string => Boolean(t));

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
