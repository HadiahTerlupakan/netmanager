/**
 * NOTE: Prisma import is intentionally kept here for type safety.
 * This service uses Prisma types for dynamic query building and filtering.
 * Removing this would require duplicating all Prisma types or losing type safety.
 * This is a valid use case and does not violate Clean Architecture principles.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/database";
import type { IAnnouncementRepository } from "../domain/ports/IAnnouncementRepository";
import { AnnouncementRepository } from "../repositories/AnnouncementRepository";
import {
  buildAnnouncementCreateData,
  buildAnnouncementUpdateData,
  buildAnnouncementWhere,
  buildMobileAnnouncementWhere,
  DEFAULT_MOBILE_PORTAL,
  DEFAULT_PORTAL,
  ensureAnnouncementExists,
  ensureAnnouncementExistsForTenant,
  getAnnouncementRepositoryMethod,
  logAnnouncementCreation,
  publishRealtimeSafely,
  RECENT_READER_LIMIT,
  resolveMobilePortal,
  sendEmployeeAnnouncementNotifications,
} from "./AnnouncementService.helpers";
import {
  attachReaderNames,
  findAnnouncementSummary,
  findRecentReaders,
} from "./AnnouncementService.readers";
import type {
  AnnouncementCreateInput,
  AnnouncementFilters,
  AnnouncementReadActor,
  AnnouncementRecord,
  AnnouncementUpdateInput,
  CustomerAnnouncementReadActor,
  MobileAnnouncementActor,
} from "./AnnouncementService.helpers";

class AnnouncementServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export class AnnouncementService {
  constructor(
    private readonly announcementRepository: IAnnouncementRepository = new AnnouncementRepository(),
  ) {}

  /** Ambil data announcement untuk form edit. */
  async getAnnouncementEditData(id: string) {
    const announcement = await this.announcementRepository.findEditById(id);
    if (!announcement) {
      return null;
    }

    return {
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      target: announcement.target,
      isActive: announcement.isActive,
      isPinned: announcement.isPinned,
      startDate: announcement.startDate?.toISOString() ?? null,
      endDate: announcement.endDate?.toISOString() ?? null,
    };
  }

  /** List announcements using the same filters used by the existing route. */
  async getAnnouncements(filters: AnnouncementFilters) {
    return getAnnouncementRepositoryMethod(
      this.announcementRepository,
      this.announcementRepository.findMany,
      "findMany",
    )({
      where: buildAnnouncementWhere(filters, new Date()),
      includeReadCount: true,
    });
  }

  /** Create an announcement and trigger downstream side effects. */
  async createAnnouncement(input: AnnouncementCreateInput, createdBy: string) {
    const isAnnouncementActive = input.isActive ?? true;
    const announcement = await getAnnouncementRepositoryMethod(
      this.announcementRepository,
      this.announcementRepository.create,
      "create",
    )(buildAnnouncementCreateData(input, createdBy, isAnnouncementActive));

    await logAnnouncementCreation(
      announcement as AnnouncementRecord,
      createdBy,
    );
    if (isAnnouncementActive) {
      publishRealtimeSafely(announcement as AnnouncementRecord);
    }
    if (isAnnouncementActive && announcement.target !== "CUSTOMER") {
      await sendEmployeeAnnouncementNotifications(
        announcement as AnnouncementRecord,
      );
    }

    return announcement;
  }

  /** Update an announcement using the existing route payload shape. */
  async updateAnnouncement(id: string, input: AnnouncementUpdateInput) {
    return getAnnouncementRepositoryMethod(
      this.announcementRepository,
      this.announcementRepository.update,
      "update",
    )(id, buildAnnouncementUpdateData(input));
  }

  /** Delete an announcement by id. */
  async deleteAnnouncement(id: string) {
    await getAnnouncementRepositoryMethod(
      this.announcementRepository,
      this.announcementRepository.delete,
      "delete",
    )(id);
    return { success: true };
  }

  /** Mark one announcement as read for an authenticated user. */
  async markAnnouncementAsRead(
    id: string,
    actor: AnnouncementReadActor,
    portal?: string,
  ) {
    await ensureAnnouncementExists(
      this.announcementRepository,
      id,
      (message, status) => new AnnouncementServiceError(message, status),
    );
    const read = await getAnnouncementRepositoryMethod(
      this.announcementRepository,
      this.announcementRepository.upsertUserRead,
      "upsertUserRead",
    )({
      announcementId: id,
      userId: actor.userId,
      portal: portal || DEFAULT_PORTAL,
    });

    return { success: true, read };
  }

  /** Mengambil daftar announcement untuk mobile berdasarkan portal user. */
  async getMobileAnnouncements(actor: MobileAnnouncementActor) {
    const announcements = await prisma.announcement.findMany({
      where: buildMobileAnnouncementWhere(
        actor.tenantId ?? null,
        resolveMobilePortal(actor.role, actor.isSuperAdmin),
        new Date(),
      ) as Prisma.AnnouncementWhereInput,
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        content: true,
        isPinned: true,
        createdAt: true,
      },
    });

    return announcements.map((announcement) => ({
      ...announcement,
      createdAt: announcement.createdAt.toISOString(),
    }));
  }

  /** Menandai announcement mobile sebagai sudah dibaca secara idempoten. */
  async markMobileAnnouncementAsRead(
    id: string,
    actor: MobileAnnouncementActor,
    portal?: string,
  ) {
    await ensureAnnouncementExistsForTenant(
      this.announcementRepository,
      id,
      actor.tenantId ?? null,
      (message, status) => new AnnouncementServiceError(message, status),
    );
    const read = await getAnnouncementRepositoryMethod(
      this.announcementRepository,
      this.announcementRepository.upsertUserRead,
      "upsertUserRead",
    )({
      announcementId: id,
      userId: actor.userId,
      portal: portal || DEFAULT_MOBILE_PORTAL,
      ...(actor.tenantId ? { tenantId: actor.tenantId } : {}),
    });

    return { success: true, read };
  }

  /** Mark one announcement as read for an authenticated customer. */
  async markAnnouncementAsReadForCustomer(
    id: string,
    actor: CustomerAnnouncementReadActor,
    portal?: string,
  ) {
    await ensureAnnouncementExists(
      this.announcementRepository,
      id,
      (message, status) => new AnnouncementServiceError(message, status),
    );
    const read = await getAnnouncementRepositoryMethod(
      this.announcementRepository,
      this.announcementRepository.upsertCustomerRead,
      "upsertCustomerRead",
    )({
      announcementId: id,
      pelangganId: actor.pelangganId,
      portal: portal || "customer",
    });

    return { success: true, read };
  }

  /** Get read statistics and recent readers for one announcement. */
  async getAnnouncementReadStats(id: string) {
    const [announcement, readCount, recentReaders] = await Promise.all([
      findAnnouncementSummary(this.announcementRepository, id),
      getAnnouncementRepositoryMethod(
        this.announcementRepository,
        this.announcementRepository.countReads,
        "countReads",
      )(id),
      findRecentReaders(this.announcementRepository, id, RECENT_READER_LIMIT),
    ]);

    if (!announcement) {
      throw new AnnouncementServiceError("Pengumuman tidak ditemukan", 404);
    }

    return {
      announcement,
      readCount,
      recentReaders: await attachReaderNames(
        this.announcementRepository,
        recentReaders,
      ),
    };
  }
}

export { AnnouncementServiceError };
export const announcementService = new AnnouncementService();
