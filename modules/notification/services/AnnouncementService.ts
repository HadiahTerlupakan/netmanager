import crypto from "crypto";
import type { Prisma, TargetAudience } from "@prisma/client";
import { firebaseRealtimeService } from "@/lib/realtime";
import { logger } from "@/lib/logger";
import { prisma } from "@/modules/database";

const ANNOUNCEMENT_PREVIEW_LIMIT = 100;
const EMPLOYEE_ROLE_NAMES = ["EMPLOYEE", "TEKNISI"];
const ADMIN_ROLE_NAMES = ["ADMIN", "SUPER_ADMIN"];
const ACTIVE_CUSTOMER_STATUS = "AKTIF";
const REALTIME_EVENT_TYPE = "announcement.new";
const ANNOUNCEMENT_LINK = "/announcement";

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

export class AnnouncementService {
  /** List announcements using the same filters used by the existing route. */
  async getAnnouncements(filters: {
    target?: TargetAudience;
    activeOnly: boolean;
    portal?: string | null;
  }) {
    const now = new Date();
    const where = this.buildAnnouncementWhere(filters, now);

    return prisma.announcement.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      include: {
        _count: {
          select: { reads: true },
        },
      },
    });
  }

  /** Create an announcement and trigger downstream side effects. */
  async createAnnouncement(input: AnnouncementCreateInput, createdBy: string) {
    const isAnnouncementActive = input.isActive ?? true;
    const announcement = await prisma.announcement.create({
      data: {
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
      },
    });

    await logger.logActivity({
      action: "CREATE",
      subject: "Announcement",
      details: {
        id: announcement.id,
        title: announcement.title,
        target: announcement.target,
      },
      userId: createdBy,
    });

    if (isAnnouncementActive) {
      this.publishRealtimeSafely(announcement);
    }

    if (isAnnouncementActive && announcement.target !== "CUSTOMER") {
      await this.sendEmployeeAnnouncementNotifications(announcement);
    }

    return announcement;
  }

  /** Build the database where clause for announcement listing. */
  private buildAnnouncementWhere(
    filters: {
      target?: TargetAudience;
      activeOnly: boolean;
      portal?: string | null;
    },
    now: Date,
  ) {
    if (filters.portal === "customer") {
      return {
        target: { in: ["ALL", "CUSTOMER"] as TargetAudience[] },
        isActive: true,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      };
    }

    if (filters.portal === "employee") {
      return {
        target: { in: ["ALL", "EMPLOYEE"] as TargetAudience[] },
        isActive: true,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      };
    }

    if (filters.portal === "admin") {
      return {
        target: { in: ["ALL", "ADMIN"] as TargetAudience[] },
        isActive: true,
        startDate: { lte: now },
        OR: [{ endDate: null }, { endDate: { gte: now } }],
      };
    }

    return {
      ...(filters.target ? { target: filters.target } : {}),
      ...(filters.activeOnly ? { isActive: true } : {}),
    };
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

export const announcementService = new AnnouncementService();
