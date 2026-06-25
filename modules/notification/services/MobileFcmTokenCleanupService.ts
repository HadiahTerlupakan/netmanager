import { prisma, prismaMitra } from "@/modules/database";
import { PushTokenRepository } from "../repositories/PushTokenRepository";

/**
 * Public service untuk hapus FCM token yang sudah tidak valid (mis.
 * uninstall app, token rotated). Caller eksternal (`lib/firebase/messaging`)
 * pakai entry ini agar tidak akses repository langsung — sesuai aturan
 * arsitektur module-public-api boundary.
 */

const repository = new PushTokenRepository();

export async function clearStaleFcmTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  await Promise.all([
    repository.clearPushTokens(tokens),
    repository.clearFcmTokensFromArrays(tokens),
  ]);
}

const STALE_TOKEN_DAYS = 30;

/**
 * Periodic cleanup untuk hapus fcmTokens[] yang sudah stale.
 * Menggunakan `pushTokenUpdatedAt` sebagai proxy freshness —
 * user yang tidak pernah update token dalam 30 hari kemungkinan
 * sudah tidak aktif atau ganti device.
 */
export async function cleanupStaleFcmTokenArrays(): Promise<{
  usersCleaned: number;
  mitrasCleaned: number;
  tokensRemoved: number;
}> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_TOKEN_DAYS);

  const staleUsers = await prisma.user.findMany({
    where: {
      fcmTokens: { isEmpty: false },
      OR: [
        { pushTokenUpdatedAt: { lt: cutoff } },
        { pushTokenUpdatedAt: null, updatedAt: { lt: cutoff } },
      ],
    },
    select: { id: true, fcmTokens: true },
  });

  const staleMitras = await prismaMitra.mitra.findMany({
    where: {
      fcmTokens: { isEmpty: false },
      OR: [
        { pushTokenUpdatedAt: { lt: cutoff } },
        { pushTokenUpdatedAt: null, updatedAt: { lt: cutoff } },
      ],
    },
    select: { id: true, fcmTokens: true },
  });

  let tokensRemoved = 0;

  const userUpdates = staleUsers.map((user) => {
    tokensRemoved += user.fcmTokens.length;
    return prisma.user.update({
      where: { id: user.id },
      data: { fcmTokens: { set: [] } },
    });
  });

  const mitraUpdates = staleMitras.map((mitra) => {
    tokensRemoved += mitra.fcmTokens.length;
    return prismaMitra.mitra.update({
      where: { id: mitra.id },
      data: { fcmTokens: { set: [] } },
    });
  });

  await Promise.all([...userUpdates, ...mitraUpdates]);

  return {
    usersCleaned: staleUsers.length,
    mitrasCleaned: staleMitras.length,
    tokensRemoved,
  };
}
