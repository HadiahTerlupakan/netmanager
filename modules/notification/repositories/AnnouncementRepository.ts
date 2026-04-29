import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/database";
import type {
  AnnouncementCreateRepositoryInput,
  AnnouncementRepositoryWhere,
  AnnouncementUpdateRepositoryInput,
  IAnnouncementRepository,
} from "../domain/ports/IAnnouncementRepository";

const DEFAULT_ANNOUNCEMENT_ORDER = [
  { isPinned: "desc" },
  { createdAt: "desc" },
] satisfies Prisma.AnnouncementOrderByWithRelationInput[];

export class AnnouncementRepository implements IAnnouncementRepository {
  /** Ambil announcement untuk form edit. */
  findEditById(id: string) {
    return prisma.announcement.findUnique({ where: { id } });
  }

  /** Ambil daftar announcement dengan filter route yang ada. */
  findMany(params: {
    where: AnnouncementRepositoryWhere;
    includeReadCount?: boolean;
  }) {
    return prisma.announcement.findMany({
      where: params.where as Prisma.AnnouncementWhereInput,
      orderBy: DEFAULT_ANNOUNCEMENT_ORDER,
      include: params.includeReadCount
        ? { _count: { select: { reads: true } } }
        : undefined,
    });
  }

  /** Membuat announcement baru. */
  create(data: AnnouncementCreateRepositoryInput) {
    return prisma.announcement.create({
      data: data as Prisma.AnnouncementUncheckedCreateInput,
    });
  }

  /** Memperbarui announcement yang ada. */
  update(id: string, data: AnnouncementUpdateRepositoryInput) {
    return prisma.announcement.update({
      where: { id },
      data: data as Prisma.AnnouncementUncheckedUpdateInput,
    });
  }

  /** Menghapus announcement berdasarkan id. */
  async delete(id: string) {
    await prisma.announcement.delete({ where: { id } });
  }

  /** Memastikan announcement tersedia. */
  findExistingById(id: string) {
    return prisma.announcement.findUnique({
      where: { id },
      select: { id: true },
    });
  }

  /** Memastikan announcement tersedia dalam tenant. */
  findExistingByIdAndTenant(id: string, tenantId: string | null) {
    return prisma.announcement.findFirst({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      select: { id: true },
    });
  }

  /** Menandai announcement dibaca oleh user. */
  upsertUserRead(input: {
    announcementId: string;
    userId: string;
    portal: string;
    tenantId?: string;
  }) {
    return prisma.announcementRead.upsert({
      where: {
        announcementId_userId: {
          announcementId: input.announcementId,
          userId: input.userId,
        },
      },
      update: { readAt: new Date() },
      create: {
        announcementId: input.announcementId,
        userId: input.userId,
        portal: input.portal,
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      },
    });
  }

  /** Menandai announcement dibaca oleh pelanggan. */
  upsertCustomerRead(input: {
    announcementId: string;
    pelangganId: string;
    portal: string;
  }) {
    return prisma.announcementRead.upsert({
      where: {
        announcementId_pelangganId: {
          announcementId: input.announcementId,
          pelangganId: input.pelangganId,
        },
      },
      update: { readAt: new Date() },
      create: {
        announcementId: input.announcementId,
        pelangganId: input.pelangganId,
        portal: input.portal,
      },
    });
  }

  /** Hitung total pembaca announcement. */
  countReads(announcementId: string) {
    return prisma.announcementRead.count({ where: { announcementId } });
  }

  /** Ambil pembaca terbaru announcement. */
  findRecentReaders(announcementId: string, limit: number) {
    return prisma.announcementRead.findMany({
      where: { announcementId },
      orderBy: { readAt: "desc" },
      take: limit,
      include: { announcement: false },
    });
  }

  /** Ambil ringkasan announcement untuk statistik. */
  findSummaryById(id: string) {
    return prisma.announcement.findUnique({
      where: { id },
      select: { id: true, title: true, target: true },
    });
  }

  /** Ambil nama user pembaca. */
  findUserNames(userIds: string[]) {
    return prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
  }

  /** Ambil nama pelanggan pembaca. */
  findCustomerNames(pelangganIds: string[]) {
    return prisma.pelanggan
      .findMany({
        where: { id: { in: pelangganIds } },
        select: { id: true, nama: true },
      })
      .then((pelanggans) =>
        pelanggans.map((pelanggan) => ({
          id: pelanggan.id,
          name: pelanggan.nama,
        })),
      );
  }
}
