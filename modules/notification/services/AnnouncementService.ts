import crypto from "crypto";
import type { Prisma, TargetAudience } from "@prisma/client";
import { firebaseRealtimeService } from "@/lib/realtime";
import { logger } from "@/lib/logger";
import { prisma } from "@/modules/database";
import { AnnouncementRepository } from "../repositories/AnnouncementRepository";
import type { IAnnouncementRepository } from "../domain/ports/IAnnouncementRepository";

const ANNOUNCEMENT_PREVIEW_LIMIT = 100;
const EMPLOYEE_ROLE_NAMES = ["EMPLOYEE", "TEKNISI"];
const ADMIN_ROLE_NAMES = ["ADMIN", "SUPER_ADMIN"];
const ACTIVE_CUSTOMER_STATUS = "AKTIF";
const REALTIME_EVENT_TYPE = "announcement.new";
const ANNOUNCEMENT_LINK = "/announcement";
const RECENT_READER_LIMIT = 10;
const UNKNOWN_USER_NAME = "Unknown User";
const UNKNOWN_CUSTOMER_NAME = "Unknown Customer";
const ANONYMOUS_READER_NAME = "Anonymous";
const DEFAULT_PORTAL = "admin";
const DEFAULT_MOBILE_PORTAL = "mobile";

type MobileAnnouncementPortal = "customer" | "employee" | "admin";

const MOBILE_PORTAL_TARGETS: Record<
  MobileAnnouncementPortal,
  TargetAudience[]
> = {
  customer: ["ALL", "CUSTOMER"],
  employee: ["ALL", "EMPLOYEE"],
  admin: ["ALL", "ADMIN"],
};

interface AnnouncementRecord {
  id: string;
  title: string;
  content: string;
  target: TargetAudience;
  isPinned: boolean;
  createdAt: Date;
}

interface AnnouncementCreateInput {
  title: string;
  content: string;
  target: TargetAudience;
  isActive?: boolean;
  isPinned?: boolean;
  startDate?: string | null;
  endDate?: string | null;
}

interface AnnouncementUpdateInput {
  title?: string;
  content?: string;
  target?: TargetAudience;
  isActive?: boolean;
  isPinned?: boolean;
  startDate?: string | null;
  endDate?: string | null;
}

interface AnnouncementFilters {
  target?: string;
  activeOnly: boolean;
  portal?: string | null;
}

interface AnnouncementReadActor {
  userId: string;
}

interface CustomerAnnouncementReadActor {
  pelangganId: string;
}

interface MobileAnnouncementActor {
  userId: string;
  tenantId?: string | null;
  role?: string | null;
  isSuperAdmin?: boolean;
}

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
    const now = new Date();
    const where = this.buildAnnouncementWhere(filters, now);

    return prisma.announcement.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      include: { _count: { select: { reads: true } } },
    });
  }

  /** Create an announcement and trigger downstream side effects. */
  async createAnnouncement(input: AnnouncementCreateInput, createdBy: string) {
    const isAnnouncementActive = input.isActive ?? true;
    const announcement = await prisma.announcement.create({
      data: this.buildAnnouncementCreateData(
        input,
        createdBy,
        isAnnouncementActive,
      ),
    });

    await this.logAnnouncementCreation(announcement, createdBy);

    if (isAnnouncementActive) {
      this.publishRealtimeSafely(announcement);
    }

    if (isAnnouncementActive && announcement.target !== "CUSTOMER") {
      await this.sendEmployeeAnnouncementNotifications(announcement);
    }

    return announcement;
  }

  /** Update an announcement using the existing route payload shape. */
  async updateAnnouncement(id: string, input: AnnouncementUpdateInput) {
    return prisma.announcement.update({
      where: { id },
      data: this.buildAnnouncementUpdateData(input),
    });
  }

  /** Delete an announcement by id. */
  async deleteAnnouncement(id: string) {
    await prisma.announcement.delete({ where: { id } });
    return { success: true };
  }

  /** Mark one announcement as read for an authenticated user. */
  async markAnnouncementAsRead(
    id: string,
    actor: AnnouncementReadActor,
    portal?: string,
  ) {
    await this.ensureAnnouncementExists(id);
    const read = await prisma.announcementRead.upsert({
      where: {
        announcementId_userId: {
          announcementId: id,
          userId: actor.userId,
        },
      },
      update: { readAt: new Date() },
      create: {
        announcementId: id,
        userId: actor.userId,
        portal: portal || DEFAULT_PORTAL,
      },
    });

    return { success: true, read };
  }

  /** Mengambil daftar announcement untuk mobile berdasarkan portal user. */
  async getMobileAnnouncements(actor: MobileAnnouncementActor) {
    const portal = this.resolveMobilePortal(actor.role, actor.isSuperAdmin);
    const tenantId = actor.tenantId ?? null;
    const announcements = await prisma.announcement.findMany({
      where: this.buildMobileAnnouncementWhere(tenantId, portal, new Date()),
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
    await this.ensureAnnouncementExistsForTenant(id, actor.tenantId ?? null);
    const read = await prisma.announcementRead.upsert({
      where: {
        announcementId_userId: {
          announcementId: id,
          userId: actor.userId,
        },
      },
      update: { readAt: new Date() },
      create: {
        announcementId: id,
        userId: actor.userId,
        portal: portal || DEFAULT_MOBILE_PORTAL,
        ...(actor.tenantId ? { tenantId: actor.tenantId } : {}),
      },
    });

    return { success: true, read };
  }

  /** Mark one announcement as read for an authenticated customer. */
  async markAnnouncementAsReadForCustomer(
    id: string,
    actor: CustomerAnnouncementReadActor,
    portal?: string,
  ) {
    await this.ensureAnnouncementExists(id);
    const read = await prisma.announcementRead.upsert({
      where: {
        announcementId_pelangganId: {
          announcementId: id,
          pelangganId: actor.pelangganId,
        },
      },
      update: { readAt: new Date() },
      create: {
        announcementId: id,
        pelangganId: actor.pelangganId,
        portal: portal || "customer",
      },
    });

    return { success: true, read };
  }

  /** Get read statistics and recent readers for one announcement. */
  async getAnnouncementReadStats(id: string) {
    const [announcement, readCount, recentReaders] = await Promise.all([
      this.findAnnouncementSummary(id),
      prisma.announcementRead.count({ where: { announcementId: id } }),
      this.findRecentReaders(id),
    ]);

    if (!announcement) {
      throw new AnnouncementServiceError("Pengumuman tidak ditemukan", 404);
    }

    const readersWithNames = await this.attachReaderNames(recentReaders);
    return { announcement, readCount, recentReaders: readersWithNames };
  }

  /** Build the database where clause for announcement listing. */
  private buildAnnouncementWhere(filters: AnnouncementFilters, now: Date) {
    if (filters.portal === "customer") {
      return this.buildPortalAnnouncementWhere(["ALL", "CUSTOMER"], now);
    }

    if (filters.portal === "employee") {
      return this.buildPortalAnnouncementWhere(["ALL", "EMPLOYEE"], now);
    }

    if (filters.portal === "admin") {
      return this.buildPortalAnnouncementWhere(["ALL", "ADMIN"], now);
    }

    const target = this.normalizeTargetAudience(filters.target);
    return {
      ...(target ? { target } : {}),
      ...(filters.activeOnly ? { isActive: true } : {}),
    };
  }

  /** Build mobile announcement filter by portal and tenant. */
  private buildMobileAnnouncementWhere(
    tenantId: string | null,
    portal: MobileAnnouncementPortal,
    now: Date,
  ) {
    return {
      target: { in: MOBILE_PORTAL_TARGETS[portal].slice() },
      isActive: true,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
      ...(tenantId ? { tenantId } : {}),
    };
  }

  /** Menentukan portal mobile dari role user yang terautentikasi. */
  private resolveMobilePortal(role?: string | null, isSuperAdmin?: boolean) {
    const normalizedRole = role?.toUpperCase() ?? "";
    if (normalizedRole.includes("CUSTOMER")) {
      return "customer" as const;
    }

    if (isSuperAdmin || normalizedRole.includes("ADMIN")) {
      return "admin" as const;
    }

    return "employee" as const;
  }

  /** Memastikan announcement tersedia dalam tenant yang sesuai. */
  private async ensureAnnouncementExistsForTenant(
    id: string,
    tenantId: string | null,
  ) {
    const announcement = await prisma.announcement.findFirst({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      select: { id: true },
    });

    if (announcement) {
      return;
    }

    throw new AnnouncementServiceError("Pengumuman tidak ditemukan", 404);
  }

  /** Normalize route target input into a valid announcement audience. */
  private normalizeTargetAudience(target?: string) {
    if (!target) {
      return undefined;
    }

    const validTargets: TargetAudience[] = [
      "ALL",
      "ADMIN",
      "EMPLOYEE",
      "CUSTOMER",
    ];
    return validTargets.includes(target as TargetAudience)
      ? (target as TargetAudience)
      : undefined;
  }

  /** Build create data for an announcement row. */
  private buildAnnouncementCreateData(
    input: AnnouncementCreateInput,
    createdBy: string,
    isAnnouncementActive: boolean,
  ) {
    return {
      id: crypto.randomUUID(),
      title: input.title,
      content: input.content,
      target: input.target,
      isActive: isAnnouncementActive,
      isPinned: input.isPinned ?? false,
      startDate: input.startDate ? new Date(input.startDate) : new Date(),
      endDate: input.endDate ? new Date(input.endDate) : null,
      createdBy,
      updatedAt: new Date(),
    };
  }

  /** Build update data for an announcement row. */
  private buildAnnouncementUpdateData(input: AnnouncementUpdateInput) {
    return {
      title: input.title,
      content: input.content,
      target: input.target,
      isActive: input.isActive,
      isPinned: input.isPinned,
      ...(input.startDate !== undefined
        ? { startDate: input.startDate ? new Date(input.startDate) : null }
        : {}),
      ...(input.endDate !== undefined
        ? { endDate: input.endDate ? new Date(input.endDate) : null }
        : {}),
    };
  }

  /** Build the common active portal filter. */
  private buildPortalAnnouncementWhere(targets: TargetAudience[], now: Date) {
    return {
      target: { in: targets },
      isActive: true,
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    };
  }

  /** Ensure an announcement exists before mutating its read state. */
  private async ensureAnnouncementExists(id: string) {
    const announcement = await prisma.announcement.findUnique({
      where: { id },
    });
    if (announcement) {
      return;
    }

    throw new AnnouncementServiceError("Pengumuman tidak ditemukan", 404);
  }

  /** Find announcement summary fields for stats output. */
  private findAnnouncementSummary(id: string) {
    return prisma.announcement.findUnique({
      where: { id },
      select: { id: true, title: true, target: true },
    });
  }

  /** Find recent readers for one announcement. */
  private findRecentReaders(id: string) {
    return prisma.announcementRead.findMany({
      where: { announcementId: id },
      orderBy: { readAt: "desc" },
      take: RECENT_READER_LIMIT,
      include: { announcement: false },
    });
  }

  /** Add resolved reader names without changing the existing response shape. */
  private async attachReaderNames(
    recentReaders: Awaited<
      ReturnType<AnnouncementService["findRecentReaders"]>
    >,
  ) {
    const [userMap, pelangganMap] = await Promise.all([
      this.findUserNameMap(recentReaders),
      this.findPelangganNameMap(recentReaders),
    ]);

    return recentReaders.map((reader) => ({
      ...reader,
      readerName: this.resolveReaderName(reader, userMap, pelangganMap),
    }));
  }

  /** Build a map of user ids to display names. */
  private async findUserNameMap(
    recentReaders: Awaited<
      ReturnType<AnnouncementService["findRecentReaders"]>
    >,
  ) {
    const userIds = recentReaders.flatMap((reader) =>
      reader.userId ? [reader.userId] : [],
    );

    if (userIds.length === 0) {
      return new Map<string, string>();
    }

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });

    return new Map(users.map((user) => [user.id, user.name]));
  }

  /** Build a map of customer ids to display names. */
  private async findPelangganNameMap(
    recentReaders: Awaited<
      ReturnType<AnnouncementService["findRecentReaders"]>
    >,
  ) {
    const pelangganIds = recentReaders.flatMap((reader) =>
      reader.pelangganId ? [reader.pelangganId] : [],
    );

    if (pelangganIds.length === 0) {
      return new Map<string, string>();
    }

    const pelanggans = await prisma.pelanggan.findMany({
      where: { id: { in: pelangganIds } },
      select: { id: true, nama: true },
    });

    return new Map(
      pelanggans.map((pelanggan) => [pelanggan.id, pelanggan.nama]),
    );
  }

  /** Resolve the display name for one reader row. */
  private resolveReaderName(
    reader: Awaited<
      ReturnType<AnnouncementService["findRecentReaders"]>
    >[number],
    userMap: Map<string, string>,
    pelangganMap: Map<string, string>,
  ) {
    if (reader.userId) {
      return userMap.get(reader.userId) || UNKNOWN_USER_NAME;
    }

    if (reader.pelangganId) {
      return pelangganMap.get(reader.pelangganId) || UNKNOWN_CUSTOMER_NAME;
    }

    return ANONYMOUS_READER_NAME;
  }

  /** Log successful announcement creation. */
  private logAnnouncementCreation(
    announcement: AnnouncementRecord,
    createdBy: string,
  ) {
    return logger.logActivity({
      action: "CREATE",
      subject: "Announcement",
      details: {
        id: announcement.id,
        title: announcement.title,
        target: announcement.target,
      },
      userId: createdBy,
    });
  }

  /** Publish realtime announcement in a fire-and-forget flow with error logging. */
  private publishRealtimeSafely(announcement: AnnouncementRecord) {
    void this.publishAnnouncementRealtime(announcement).catch(
      (realtimeError) => {
        logger.error(
          "[Announcements] Failed to publish realtime update",
          realtimeError as Error,
          { announcementId: announcement.id },
        );
      },
    );
  }

  /** Publish realtime announcement event to matching recipient scopes. */
  private async publishAnnouncementRealtime(announcement: AnnouncementRecord) {
    const payload = this.buildRealtimePayload(announcement);

    if (announcement.target === "ADMIN") {
      await this.publishToAdminScope(payload);
      return;
    }

    if (announcement.target === "EMPLOYEE") {
      const employeeIds = await this.findEmployeeIds();
      await this.publishToUserScopes(employeeIds, payload);
      return;
    }

    if (announcement.target === "CUSTOMER") {
      const customerIds = await this.findActiveCustomerIds();
      await this.publishToUserScopes(customerIds, payload);
      return;
    }

    const [employeeIds, customerIds] = await Promise.all([
      this.findEmployeeIds(),
      this.findActiveCustomerIds(),
    ]);

    await this.publishToAdminScope(payload);
    await this.publishToUserScopes([...employeeIds, ...customerIds], payload);
  }

  /** Build the realtime payload from an announcement entity. */
  private buildRealtimePayload(announcement: AnnouncementRecord) {
    return {
      id: announcement.id,
      title: announcement.title,
      content: announcement.content,
      target: announcement.target,
      isPinned: announcement.isPinned,
      createdAt: announcement.createdAt.toISOString(),
    };
  }

  /** Publish an announcement event to the admin scope. */
  private async publishToAdminScope(
    payload: ReturnType<AnnouncementService["buildRealtimePayload"]>,
  ) {
    await firebaseRealtimeService.publish({
      type: REALTIME_EVENT_TYPE,
      scope: { kind: "admin", id: "announcements" },
      payload,
    });
  }

  /** Publish an announcement event to many user scopes. */
  private async publishToUserScopes(
    userIds: string[],
    payload: ReturnType<AnnouncementService["buildRealtimePayload"]>,
  ) {
    await Promise.all(
      userIds.map((id) =>
        firebaseRealtimeService.publish({
          type: REALTIME_EVENT_TYPE,
          scope: { kind: "user", id },
          payload,
        }),
      ),
    );
  }

  /** Send push notifications and persistent notifications for employees/admins. */
  private async sendEmployeeAnnouncementNotifications(
    announcement: AnnouncementRecord,
  ) {
    try {
      const userFilter = this.buildNotificationUserFilter(announcement.target);
      const dbUserFilter = this.buildNotificationDbUserFilter(
        announcement.target,
      );
      const users = await prisma.user.findMany({
        where: userFilter,
        select: { id: true, pushToken: true },
      });
      const usersOnLeave = await this.findUsersOnLeave(
        users.map((user) => user.id),
      );
      const tokens = users
        .filter((user) => !usersOnLeave.has(user.id))
        .map((user) => user.pushToken)
        .filter((token): token is string => !!token);

      if (tokens.length > 0) {
        const { sendExpoPushNotifications } = await import("@/lib/expo");
        await sendExpoPushNotifications(
          tokens,
          announcement.title,
          this.buildAnnouncementPreview(announcement.content),
          { announcementId: announcement.id, url: ANNOUNCEMENT_LINK },
        );
      }

      const targetedUsers = await prisma.user.findMany({
        where: dbUserFilter,
        select: { id: true },
      });

      if (targetedUsers.length === 0) {
        return;
      }

      await prisma.notifications.createMany({
        data: targetedUsers.map((user) => ({
          id: crypto.randomUUID(),
          type: "ANNOUNCEMENT",
          title: announcement.title,
          message: this.buildAnnouncementPreview(announcement.content),
          userId: user.id,
          sourceType: "ANNOUNCEMENT",
          sourceId: announcement.id,
          isRead: false,
          priority: "NORMAL",
          createdAt: new Date(),
        })),
      });
    } catch (pushError) {
      logger.error(
        "[Announcements] Failed to send push notifications",
        pushError as Error,
      );
    }
  }

  /** Build user filter for push-token queries. */
  private buildNotificationUserFilter(
    target: TargetAudience,
  ): Prisma.UserWhereInput {
    return {
      pushToken: { not: null },
      isActive: true,
      ...this.buildRoleFilter(target),
    };
  }

  /** Build user filter for persistent notification rows. */
  private buildNotificationDbUserFilter(
    target: TargetAudience,
  ): Prisma.UserWhereInput {
    return {
      isActive: true,
      ...this.buildRoleFilter(target),
    };
  }

  /** Build role filter for announcement recipients. */
  private buildRoleFilter(target: TargetAudience): Prisma.UserWhereInput {
    if (target === "EMPLOYEE") {
      return { role: { name: { in: EMPLOYEE_ROLE_NAMES } } };
    }

    if (target === "ADMIN") {
      return { role: { name: { in: ADMIN_ROLE_NAMES } } };
    }

    return {};
  }

  /** Find employee ids eligible for realtime announcement delivery. */
  private async findEmployeeIds() {
    const employees = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { name: { in: EMPLOYEE_ROLE_NAMES } },
      },
      select: { id: true },
    });

    return employees.map((employee) => employee.id);
  }

  /** Find active customer ids eligible for realtime announcement delivery. */
  private async findActiveCustomerIds() {
    const customers = await prisma.pelanggan.findMany({
      where: { status: ACTIVE_CUSTOMER_STATUS },
      select: { id: true },
    });

    return customers.map((customer) => customer.id);
  }

  /** Find users currently on approved leave. */
  private async findUsersOnLeave(userIds: string[]) {
    if (userIds.length === 0) {
      return new Set<string>();
    }

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const usersOnLeave = await prisma.leaveRequest.findMany({
      where: {
        status: "APPROVED",
        startDate: { lte: now },
        endDate: { gte: startOfToday },
        userId: { in: userIds },
      },
      select: { userId: true },
    });

    return new Set(usersOnLeave.map((user) => user.userId));
  }

  /** Build short preview text for push and notification message fields. */
  private buildAnnouncementPreview(content: string) {
    const preview = content.substring(0, ANNOUNCEMENT_PREVIEW_LIMIT);
    return content.length > ANNOUNCEMENT_PREVIEW_LIMIT
      ? `${preview}...`
      : preview;
  }
}

export { AnnouncementServiceError };
export const announcementService = new AnnouncementService();
