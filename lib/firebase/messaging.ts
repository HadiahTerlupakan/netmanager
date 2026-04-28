import { logger } from "@/lib/logger";
import { messaging } from "@/lib/firebase/admin";
import { prisma } from "@/lib/prisma";
import { prismaMitra } from "@/lib/prisma-mitra";

/**
 * Mendapatkan semua token FCM dari pengguna dengan role Admin (Backend)
 */
export async function getAdminTokens(): Promise<string[]> {
  try {
    const admins = await prisma.user.findMany({
      where: {
        role: {
          name: {
            in: ["SUPER_ADMIN", "Super Admin", "Admin", "Admin Payment"],
          },
        },
        isActive: true,
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
 * Mengirim notifikasi multicast FCM ke daftar token
 */
export async function sendFCMNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  if (!tokens || tokens.length === 0) return;

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
  } catch (error) {
    logger.error("[FCM] Error sending Multicast:", error);
  }
}
