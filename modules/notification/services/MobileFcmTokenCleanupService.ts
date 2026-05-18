import { PushTokenRepository } from "../repositories/PushTokenRepository";

/**
 * Public service untuk hapus FCM token yang sudah tidak valid (mis.
 * uninstall app, token rotated). Caller eksternal (`lib/firebase/messaging`)
 * pakai entry ini agar tidak akses repository langsung — sesuai aturan
 * arsitektur module-public-api boundary.
 *
 * Sebelumnya `lib/firebase/messaging.ts` import `PushTokenRepository`
 * langsung; itu pelanggaran isolation antar modul.
 */

const repository = new PushTokenRepository();

export async function clearStaleFcmTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  await repository.clearPushTokens(tokens);
}
