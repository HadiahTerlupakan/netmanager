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

function buildLegacyPushTokenPayload(pushToken: string | null) {
  return {
    pushToken,
    pushTokenUpdatedAt: pushToken ? new Date() : null,
  };
}

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
    if (next) {
      await tx.user.update({
        where: { id: userId },
        data: { fcmTokens: { set: next } },
      });
    }
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
    if (next) {
      await tx.pelanggan.update({
        where,
        data: { fcmTokens: { set: next } },
      });
    }
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
    if (next) {
      await tx.mitra.update({
        where: { id: mitraId },
        data: { fcmTokens: { set: next } },
      });
    }
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
  async findUserPushToken(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { pushToken: true },
    });
    return user?.pushToken || null;
  }

  async findMitraPushToken(mitraId: string): Promise<string | null> {
    const mitra = await prismaMitra.mitra.findUnique({
      where: { id: mitraId },
      select: { pushToken: true },
    });
    return mitra?.pushToken || null;
  }

  async findPelangganPushToken(pelangganId: string): Promise<string | null> {
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: pelangganId },
      select: { pushToken: true },
    });
    return pelanggan?.pushToken || null;
  }

  async findUsersWithPushToken(
    userIds: string[],
  ): Promise<Array<{ id: string; pushToken: string }>> {
    return prisma.user.findMany({
      where: { id: { in: userIds }, pushToken: { not: null } },
      select: { id: true, pushToken: true },
    });
  }

  async findMitrasWithPushToken(
    mitraIds: string[],
  ): Promise<Array<{ id: string; pushToken: string }>> {
    return prismaMitra.mitra.findMany({
      where: { id: { in: mitraIds }, pushToken: { not: null } },
      select: { id: true, pushToken: true },
    });
  }

  async findUsersByDepartmentWithPushToken(
    departmentId: string,
  ): Promise<Array<{ id: string; pushToken: string }>> {
    return prisma.user.findMany({
      where: { departmentId, isActive: true, pushToken: { not: null } },
      select: { id: true, pushToken: true },
    });
  }

  async findActiveUsersWithPushTokenBySite(
    departmentId?: string,
    siteId?: string,
    excludeUserId?: string,
  ): Promise<Array<{ id: string }>> {
    const whereClause: Record<string, unknown> = {
      isActive: true,
      pushToken: { not: null },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    };

    if (siteId) {
      whereClause.OR = [{ siteId }, { userSites: { some: { siteId } } }];
    }

    if (departmentId) {
      whereClause.departmentId = departmentId;
    }

    return prisma.user.findMany({
      where: whereClause,
      select: { id: true },
    });
  }

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

  async findUsersByPushTokens(
    tokens: string[],
  ): Promise<Array<{ id: string; pushToken: string }>> {
    return prisma.user.findMany({
      where: { pushToken: { in: tokens } },
      select: { id: true, pushToken: true },
    });
  }

  async findMitrasByPushTokens(
    tokens: string[],
  ): Promise<Array<{ id: string; pushToken: string }>> {
    return prismaMitra.mitra.findMany({
      where: { pushToken: { in: tokens } },
      select: { id: true, pushToken: true },
    });
  }

  async findPelanggansByPushTokens(
    tokens: string[],
  ): Promise<Array<{ id: string; pushToken: string }>> {
    return prisma.pelanggan.findMany({
      where: { pushToken: { in: tokens } },
      select: { id: true, pushToken: true },
    });
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

  async clearLegacyPushTokenOwners(input: {
    userId: string;
    tenantId: string | null;
    pushToken: string;
  }) {
    await Promise.all([
      prisma.user.updateMany({
        where: {
          pushToken: input.pushToken,
          id: { not: input.userId },
          tenantId: input.tenantId ?? undefined,
        },
        data: { pushToken: null, pushTokenUpdatedAt: null },
      }),
      prisma.pelanggan.updateMany({
        where: {
          pushToken: input.pushToken,
          id: { not: input.userId },
          tenantId: input.tenantId ?? undefined,
        },
        data: { pushToken: null, pushTokenUpdatedAt: null },
      }),
      prismaMitra.mitra.updateMany({
        where: { pushToken: input.pushToken, id: { not: input.userId } },
        data: { pushToken: null, pushTokenUpdatedAt: null },
      }),
    ]);
  }

  async updateLegacyOwnerPushToken(
    session: IMobileFcmSession,
    pushToken: string | null,
  ) {
    if (session.role === "CUSTOMER") {
      await prisma.pelanggan.update({
        where: { id: session.id, tenantId: session.tenantId ?? undefined },
        data: buildLegacyPushTokenPayload(pushToken),
      });
      return;
    }

    if (session.role === "MITRA") {
      await prismaMitra.mitra.update({
        where: { id: session.id },
        data: buildLegacyPushTokenPayload(pushToken),
      });
      return;
    }

    await prisma.user.update({
      where: { id: session.id, tenantId: session.tenantId ?? undefined },
      data: buildLegacyPushTokenPayload(pushToken),
    });
  }
}
