import { prisma, prismaMitra } from "@/modules/database";
import type { IPushTokenRepository } from "../domain/ports/IPushTokenRepository";

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
    if (session.role === "MITRA") {
      await prismaMitra.mitra.update({
        where: { id: userId },
        data: { fcmTokens: { push: fcmToken } },
      });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: { fcmTokens: { push: fcmToken } },
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
}
