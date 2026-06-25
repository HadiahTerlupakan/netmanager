import { prisma, prismaMitra } from "@/modules/database";
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
   * Hapus token dari array fcmTokens[] di User dan Mitra.
   * Ini adalah ROOT CAUSE fix — sebelumnya cleanup hanya bersihkan
   * legacy `pushToken` tapi tidak menyentuh array `fcmTokens[]`
   * sehingga stale token terus menumpuk dan gagal di setiap multicast.
   */
  async clearFcmTokensFromArrays(tokens: string[]): Promise<number> {
    if (tokens.length === 0) return 0;
    const tokenSet = new Set(tokens);
    let removedCount = 0;

    const [users, mitras] = await Promise.all([
      prisma.user.findMany({
        where: { fcmTokens: { hasSome: tokens } },
        select: { id: true, fcmTokens: true },
      }),
      prismaMitra.mitra.findMany({
        where: { fcmTokens: { hasSome: tokens } },
        select: { id: true, fcmTokens: true },
      }),
    ]);

    const userUpdates = users
      .map((user) => {
        const filtered = user.fcmTokens.filter((t) => !tokenSet.has(t));
        const removed = user.fcmTokens.length - filtered.length;
        if (removed === 0) return null;
        removedCount += removed;
        return prisma.user.update({
          where: { id: user.id },
          data: { fcmTokens: { set: filtered } },
        });
      })
      .filter(Boolean);

    const mitraUpdates = mitras
      .map((mitra) => {
        const filtered = mitra.fcmTokens.filter((t) => !tokenSet.has(t));
        const removed = mitra.fcmTokens.length - filtered.length;
        if (removed === 0) return null;
        removedCount += removed;
        return prismaMitra.mitra.update({
          where: { id: mitra.id },
          data: { fcmTokens: { set: filtered } },
        });
      })
      .filter(Boolean);

    await Promise.all([...userUpdates, ...mitraUpdates]);
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

  async findOwnerTokens(
    session: { role?: string; tenantId?: string | null },
    userId: string,
  ) {
    const where = { id: userId, tenantId: session.tenantId ?? undefined };

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

  async appendOwnerToken(
    session: { role?: string },
    userId: string,
    fcmToken: string,
  ) {
    // Atomic dedup: read-merge-write dalam transaksi agar 2 request paralel
    // (login + tokenRefresh listener firing bersamaan) tidak menghasilkan
    // duplikat di array `fcmTokens`. Tanpa transaksi, race window membuka
    // celah multicast push notifikasi yang sama berkali-kali ke 1 device.
    if (session.role === "MITRA") {
      await prismaMitra.$transaction(async (tx) => {
        const owner = await tx.mitra.findUnique({
          where: { id: userId },
          select: { fcmTokens: true },
        });
        const next = mergeFcmTokenSet(owner?.fcmTokens ?? [], fcmToken);
        await tx.mitra.update({
          where: { id: userId },
          data: { fcmTokens: { set: next } },
        });
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      const owner = await tx.user.findUnique({
        where: { id: userId },
        select: { fcmTokens: true },
      });
      const next = mergeFcmTokenSet(owner?.fcmTokens ?? [], fcmToken);
      await tx.user.update({
        where: { id: userId },
        data: { fcmTokens: { set: next } },
      });
    });
  }

  async replaceOwnerTokens(
    session: { role?: string },
    userId: string,
    fcmTokens: string[],
  ) {
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
