import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { DEFAULT_USER_SEARCH_LIMIT } from "../domain/chat.constants";

/** Query user untuk kebutuhan fitur chat. */
export class ChatUserRepository {
  /** Cari user aktif untuk memulai chat baru. */
  async searchUsers(tenantId: string, search?: string, excludeUserId?: string) {
    return prisma.user.findMany({
      where: buildUserSearchWhere({ tenantId, search, excludeUserId }),
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        departments: { select: { name: true } },
        sites: { select: { name: true } },
      },
      take: DEFAULT_USER_SEARCH_LIMIT,
      orderBy: { name: "asc" },
    });
  }

  /** Cek apakah user adalah karyawan tenant aktif. */
  async isEmployeeUser(userId: string, tenantId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true },
    });
    return Boolean(user);
  }

  /**
   * Hitung berapa id yang memang karyawan aktif tenant ini. Dipakai sebelum
   * membuat percakapan: tanpa cek ini id user tenant lain ikut tersimpan
   * sebagai peserta, nama dan fotonya bocor, dan ia menerima pesan.
   */
  async countActiveEmployees(userIds: string[], tenantId: string) {
    return prisma.user.count({
      where: { id: { in: userIds }, tenantId, isActive: true },
    });
  }

  /** Ambil semua user aktif tenant untuk broadcast. */
  async getAllActiveUsers(tenantId: string) {
    return prisma.user.findMany({
      where: { isActive: true, tenantId },
      select: { id: true },
      orderBy: { name: "asc" },
    });
  }
}

function buildUserSearchWhere(input: {
  tenantId: string;
  search?: string;
  excludeUserId?: string;
}): Prisma.UserWhereInput {
  return {
    isActive: true,
    tenantId: input.tenantId,
    ...(input.excludeUserId ? { id: { not: input.excludeUserId } } : {}),
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" } },
            { email: { contains: input.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}
