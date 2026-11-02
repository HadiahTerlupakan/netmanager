import {
  releaseFcmTokenInMainDb,
  releaseFcmTokenInMitraDb,
  type FcmTokenClaimant,
} from "@/lib/firebase/fcm-token-ownership";
import { prisma, prismaMitra } from "@/modules/database";
import {
  findInvestorFcmTokenOwners,
  replaceInvestorFcmTokens,
} from "@/modules/investor/public-queries";
import type {
  IMobileFcmSession,
  IPushTokenRepository,
} from "../domain/ports/IPushTokenRepository";

/**
 * Gabungkan token baru ke array existing tanpa duplikat. Dipakai oleh
 * `appendOwnerToken` untuk dedup atomic — array fcmTokens di DB tidak
 * punya unique constraint sehingga harus didedup di application layer.
 */
function mergeFcmTokenSet(existing: string[], next: string): string[] {
  return Array.from(new Set([...existing, next]));
}

/** Token pemilik setelah token baru masuk; null bila ia sudah memegangnya. */
function addedFcmTokens(
  existing: string[] | undefined,
  fcmToken: string,
): string[] | null {
  const tokens = existing ?? [];
  return tokens.includes(fcmToken) ? null : mergeFcmTokenSet(tokens, fcmToken);
}

/**
 * Data update saat perangkat menyinkronkan token: token baru (bila ada) dan
 * `pushTokenUpdatedAt` = sekarang, walau tokennya sudah tersimpan. Kolom itu
 * penanda kesegaran yang dipakai cron `cleanup-stale-fcm-tokens`; dulu hanya
 * diperbarui saat registrasi token Expo, sehingga cron mengosongkan token FCM
 * karyawan, pelanggan, dan mitra yang masih aktif setiap malam. Investor sudah
 * memperbaruinya sejak awal.
 */
function freshTokenData(next: string[] | null) {
  return {
    ...(next ? { fcmTokens: { set: next } } : {}),
    pushTokenUpdatedAt: new Date(),
  };
}

const CUSTOMER_ROLE = "CUSTOMER";

/** Baris pelanggan pemilik sesi: id-nya, dibatasi tenant sesi itu. */
function customerOwnerWhere(session: IMobileFcmSession, pelangganId: string) {
  return { id: pelangganId, tenantId: session.tenantId ?? undefined };
}

/**
 * Klaim token untuk staf: simpan bila belum ada, lepas dari pemilik lain di
 * database utama dalam transaksi itu, lalu dari mitra sesudahnya. Read-merge-
 * write di dalam transaksi supaya login dan penyegaran token yang tiba
 * bersamaan tidak menggandakan token.
 */
async function claimUserFcmToken(userId: string, fcmToken: string) {
  const claimant = await prisma.$transaction(async (tx) => {
    const owner = await tx.user.findUnique({
      where: { id: userId },
      select: { fcmTokens: true, tenantId: true },
    });
    const next = addedFcmTokens(owner?.fcmTokens, fcmToken);
    await tx.user.update({
      where: { id: userId },
      data: freshTokenData(next),
    });
    const userClaimant: FcmTokenClaimant = {
      kind: "user",
      id: userId,
      tenantId: owner?.tenantId ?? null,
    };
    await releaseFcmTokenInMainDb(tx, fcmToken, userClaimant);
    return userClaimant;
  });
  await releaseFcmTokenInMitraDb(prismaMitra, fcmToken, claimant);
}

/** Seperti `claimUserFcmToken`, untuk pelanggan dalam tenant sesinya. */
async function claimCustomerFcmToken(
  where: ReturnType<typeof customerOwnerWhere>,
  fcmToken: string,
) {
  const claimant = await prisma.$transaction(async (tx) => {
    const owner = await tx.pelanggan.findUnique({
      where,
      select: { fcmTokens: true, tenantId: true },
    });
    const next = addedFcmTokens(owner?.fcmTokens, fcmToken);
    await tx.pelanggan.update({
      where,
      data: freshTokenData(next),
    });
    const customerClaimant: FcmTokenClaimant = {
      kind: "pelanggan",
      id: where.id,
      tenantId: owner?.tenantId ?? null,
    };
    await releaseFcmTokenInMainDb(tx, fcmToken, customerClaimant);
    return customerClaimant;
  });
  await releaseFcmTokenInMitraDb(prismaMitra, fcmToken, claimant);
}

/** Seperti `claimUserFcmToken`; transaksinya di database mitra, database utama sesudahnya. */
async function claimMitraFcmToken(mitraId: string, fcmToken: string) {
  const claimant = await prismaMitra.$transaction(async (tx) => {
    const owner = await tx.mitra.findUnique({
      where: { id: mitraId },
      select: { fcmTokens: true, tenantId: true },
    });
    const next = addedFcmTokens(owner?.fcmTokens, fcmToken);
    await tx.mitra.update({
      where: { id: mitraId },
      data: freshTokenData(next),
    });
    const mitraClaimant: FcmTokenClaimant = {
      kind: "mitra",
      id: mitraId,
      tenantId: owner?.tenantId ?? null,
    };
    await releaseFcmTokenInMitraDb(tx, fcmToken, mitraClaimant);
    return mitraClaimant;
  });
  await releaseFcmTokenInMainDb(prisma, fcmToken, claimant);
}

export class PushTokenRepository implements IPushTokenRepository {
  async clearPushTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await Promise.all([
      prisma.user.updateMany({
        where: { pushToken: { in: tokens } },
        data: { pushToken: null },
      }),
      prismaMitra.mitra.updateMany({
        where: { pushToken: { in: tokens } },
        data: { pushToken: null },
      }),
      prisma.pelanggan.updateMany({
        where: { pushToken: { in: tokens } },
        data: { pushToken: null },
      }),
    ]);
  }

  /**
   * Hapus token dari array fcmTokens[] di User, Mitra, Investor, dan Pelanggan.
   * Ini adalah ROOT CAUSE fix — sebelumnya cleanup hanya bersihkan
   * legacy `pushToken` tapi tidak menyentuh array `fcmTokens[]`
   * sehingga stale token terus menumpuk dan gagal di setiap multicast.
   */
  async clearFcmTokensFromArrays(tokens: string[]): Promise<number> {
    if (tokens.length === 0) return 0;
    const tokenSet = new Set(tokens);
    let removedCount = 0;

    const [users, mitras, investors, pelanggans] = await Promise.all([
      prisma.user.findMany({
        where: { fcmTokens: { hasSome: tokens } },
        select: { id: true, fcmTokens: true },
      }),
      prismaMitra.mitra.findMany({
        where: { fcmTokens: { hasSome: tokens } },
        select: { id: true, fcmTokens: true },
      }),
      findInvestorFcmTokenOwners(tokens),
      prisma.pelanggan.findMany({
        where: { fcmTokens: { hasSome: tokens } },
        select: { id: true, fcmTokens: true },
      }),
    ]);

    const pemilik = [
      ...users.map((user) => ({
        fcmTokens: user.fcmTokens,
        simpan: (sisa: string[]) =>
          prisma.user.update({
            where: { id: user.id },
            data: { fcmTokens: { set: sisa } },
          }),
      })),
      ...mitras.map((mitra) => ({
        fcmTokens: mitra.fcmTokens,
        simpan: (sisa: string[]) =>
          prismaMitra.mitra.update({
            where: { id: mitra.id },
            data: { fcmTokens: { set: sisa } },
          }),
      })),
      ...investors.map((investor) => ({
        fcmTokens: investor.fcmTokens,
        simpan: (sisa: string[]) => replaceInvestorFcmTokens(investor.id, sisa),
      })),
      ...pelanggans.map((pelanggan) => ({
        fcmTokens: pelanggan.fcmTokens,
        simpan: (sisa: string[]) =>
          prisma.pelanggan.update({
            where: { id: pelanggan.id },
            data: { fcmTokens: { set: sisa } },
          }),
      })),
    ];

    const updates = pemilik.flatMap(({ fcmTokens, simpan }) => {
      const sisa = fcmTokens.filter((token) => !tokenSet.has(token));
      const removed = fcmTokens.length - sisa.length;
      if (removed === 0) return [];
      removedCount += removed;
      return [simpan(sisa)];
    });

    await Promise.all(updates);
    return removedCount;
  }

  async findOwnerTokens(session: IMobileFcmSession, userId: string) {
    const where = { id: userId, tenantId: session.tenantId ?? undefined };

    if (session.role === CUSTOMER_ROLE) {
      return prisma.pelanggan.findFirst({
        where,
        select: { id: true, fcmTokens: true },
      });
    }

    if (session.role === "MITRA") {
      return prismaMitra.mitra.findFirst({
        where,
        select: { id: true, fcmTokens: true },
      });
    }

    return prisma.user.findFirst({
      where,
      select: { id: true, fcmTokens: true },
    });
  }

  /**
   * Simpan token untuk pemilik sesi dan lepas dari setiap pemilik lain, di
   * database mana pun, supaya perangkat yang berpindah tangan tidak menerima
   * push pemilik lamanya.
   */
  async appendOwnerToken(
    session: IMobileFcmSession,
    userId: string,
    fcmToken: string,
  ) {
    if (session.role === CUSTOMER_ROLE) {
      await claimCustomerFcmToken(
        customerOwnerWhere(session, userId),
        fcmToken,
      );
      return;
    }
    if (session.role === "MITRA") {
      await claimMitraFcmToken(userId, fcmToken);
      return;
    }
    await claimUserFcmToken(userId, fcmToken);
  }

  async replaceOwnerTokens(
    session: IMobileFcmSession,
    userId: string,
    fcmTokens: string[],
  ) {
    if (session.role === CUSTOMER_ROLE) {
      await prisma.pelanggan.update({
        where: customerOwnerWhere(session, userId),
        data: { fcmTokens: { set: fcmTokens } },
      });
      return;
    }

    if (session.role === "MITRA") {
      await prismaMitra.mitra.update({
        where: { id: userId },
        data: { fcmTokens: { set: fcmTokens } },
      });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { fcmTokens: { set: fcmTokens } },
    });
  }
}
