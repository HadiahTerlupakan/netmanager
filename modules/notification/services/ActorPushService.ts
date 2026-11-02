import {
  getMitraFcmTokens,
  getUserFcmTokens,
  sendFCMNotification,
} from "@/lib/firebase/messaging";
import { logger } from "@/lib/logger";
import { toFcmData } from "./fcm-data";

/** Penerima push: karyawan (`user`) atau mitra. */
export interface PushActor {
  type: string;
  id: string;
}

/**
 * Kirim push ke perangkat karyawan dan mitra lewat FCM (`fcmTokens`).
 * Mengembalikan jumlah perangkat yang diterima FCM; galat dicatat dan
 * dianggap 0 supaya pemanggil (sering fire-and-forget) tidak ikut gagal.
 */
export async function sendPushToActors(
  actors: PushActor[],
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<number> {
  try {
    const [userTokens, mitraTokens] = await Promise.all([
      getUserFcmTokens(idsOfType(actors, "user")),
      getMitraFcmTokens(idsOfType(actors, "mitra")),
    ]);
    const tokens = [...new Set([...userTokens, ...mitraTokens])];
    if (tokens.length === 0) return 0;
    return await sendFCMNotification(tokens, title, body, toFcmData(data));
  } catch (error) {
    logger.error("[Push] FCM ke aktor gagal:", error);
    return 0;
  }
}

function idsOfType(actors: PushActor[], type: string): string[] {
  return [...new Set(actors.filter((a) => a.type === type).map((a) => a.id))];
}
