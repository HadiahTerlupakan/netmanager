import { logger } from "@/lib/logger";
import {
  getMitraFcmTokens,
  getUserFcmTokens,
  sendFCMNotification,
} from "@/lib/firebase/messaging";
import { toFcmData } from "./fcm-data";
import { sendPushToUsers } from "./ExpoPushService";

/** Penerima push: karyawan (`user`) atau mitra. */
export interface PushActor {
  type: string;
  id: string;
}

/**
 * Kirim push ke karyawan dan mitra lewat FCM — kanal aplikasi sekarang
 * (`fcmTokens`) — dan lewat Expo untuk pemasangan era Expo (`pushToken`).
 * Satu kanal yang gagal tidak menahan kanal lain. Mengembalikan jumlah
 * perangkat yang diterima FCM.
 */
export async function sendPushToActors(
  actors: PushActor[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<number> {
  const userIds = idsOfType(actors, "user");
  const mitraIds = idsOfType(actors, "mitra");

  const [fcmDelivery] = await Promise.allSettled([
    sendToFcm(userIds, mitraIds, title, body, data),
    sendPushToUsers([...userIds, ...mitraIds], title, body, data),
  ]);
  if (fcmDelivery.status === "rejected") {
    logger.error("[Push] FCM ke aktor gagal:", fcmDelivery.reason);
    return 0;
  }
  return fcmDelivery.value;
}

async function sendToFcm(
  userIds: string[],
  mitraIds: string[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<number> {
  const [userTokens, mitraTokens] = await Promise.all([
    getUserFcmTokens(userIds),
    getMitraFcmTokens(mitraIds),
  ]);
  const tokens = [...new Set([...userTokens, ...mitraTokens])];
  if (tokens.length === 0) return 0;
  return sendFCMNotification(tokens, title, body, toFcmData(data));
}

function idsOfType(actors: PushActor[], type: string): string[] {
  return [...new Set(actors.filter((a) => a.type === type).map((a) => a.id))];
}
