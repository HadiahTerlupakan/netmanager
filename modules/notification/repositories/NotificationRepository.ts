/**
 * NotificationRepository
 *
 * Database operations for notification domain entities.
 */

import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotificationMapper } from "../mappers/NotificationMapper";
import type {
  CreateFullNotificationInput,
  CreateNotificationInput,
  INotificationRepository,
  NotificationFilters,
} from "../domain/ports/INotificationRepository";
import type { NotificationEntity } from "../domain/entities/NotificationEntity";

const DEFAULT_QUERY_LIMIT = 50;
const DEFAULT_OFFSET = 0;
const DEFAULT_PRIORITY = "NORMAL";

export class NotificationRepository implements INotificationRepository {
  /** Find all notifications for a user. */
  async findByUserId(
    userId: string,
    filters: Omit<NotificationFilters, "userId"> = {},
  ): Promise<{ data: NotificationEntity[]; total: number }> {
    const where = this.buildUserWhere(userId, filters);
    const [records, total] = await Promise.all([
      prisma.notifications.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: filters.skip,
        take: filters.take,
      }),
      prisma.notifications.count({ where }),
    ]);

    return { data: NotificationMapper.toDomainList(records), total };
  }

  /** Find one notification by id. */
  async findById(id: string): Promise<NotificationEntity | null> {
    const record = await prisma.notifications.findUnique({ where: { id } });
    return record ? NotificationMapper.toDomain(record) : null;
  }

  /** Create a user-scoped notification. */
  async create(data: CreateNotificationInput): Promise<NotificationEntity> {
    const record = await prisma.notifications.create({
      data: {
        id: crypto.randomUUID(),
        title: data.title,
        message: data.message,
        type: data.type,
        priority: data.priority || DEFAULT_PRIORITY,
        link: data.link,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        user: { connect: { id: data.userId } },
      },
    });

    return NotificationMapper.toDomain(record);
  }

  /** Mark a notification as read. */
  async markAsRead(id: string): Promise<NotificationEntity> {
    const record = await prisma.notifications.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });

    return NotificationMapper.toDomain(record);
  }

  /** Mark all unread notifications as read for a user. */
  async markAllAsRead(userId: string): Promise<{ count: number }> {
    return prisma.notifications.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /** Delete a notification by id. */
  async delete(id: string): Promise<NotificationEntity> {
    const record = await prisma.notifications.delete({ where: { id } });
    return NotificationMapper.toDomain(record);
  }

  /** Delete all notifications owned by a user. */
  async deleteAllByUserId(userId: string): Promise<{ count: number }> {
    return prisma.notifications.deleteMany({ where: { userId } });
  }

  /** Count unread notifications for a user. */
  async countUnread(userId: string): Promise<number> {
    return prisma.notifications.count({ where: { userId, isRead: false } });
  }

  /** Get notification totals and unread count for a user. */
  async getCounts(userId: string): Promise<{ total: number; unread: number }> {
    const [total, unread] = await Promise.all([
      prisma.notifications.count({ where: { userId } }),
      prisma.notifications.count({ where: { userId, isRead: false } }),
    ]);

    return { total, unread };
  }

  /** Create a full notification row with all supported scopes. */
  async createFull(
    data: CreateFullNotificationInput,
  ): Promise<NotificationEntity> {
    const record = await prisma.notifications.create({ data });
    return NotificationMapper.toDomain(record);
  }

  /** Find many scoped notifications for inbox queries. */
  async findManyForUser(
    where: Prisma.NotificationsWhereInput,
    options?: { take?: number; skip?: number },
  ): Promise<NotificationEntity[]> {
    const records = await prisma.notifications.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options?.take || DEFAULT_QUERY_LIMIT,
      skip: options?.skip || DEFAULT_OFFSET,
    });

    return NotificationMapper.toDomainList(records);
  }

  /** Count notifications by custom where clause. */
  async countWhere(where: Prisma.NotificationsWhereInput): Promise<number> {
    return prisma.notifications.count({ where });
  }

  /** Find one scoped notification by custom where clause. */
  async findFirst(
    where: Prisma.NotificationsWhereInput,
  ): Promise<NotificationEntity | null> {
    const record = await prisma.notifications.findFirst({ where });
    return record ? NotificationMapper.toDomain(record) : null;
  }

  /** Update many notifications by custom where clause. */
  async updateMany(
    where: Prisma.NotificationsWhereInput,
    data: Prisma.NotificationsUpdateManyMutationInput,
  ): Promise<{ count: number }> {
    return prisma.notifications.updateMany({ where, data });
  }

  /** Count unread notifications through the optimized raw query. */
  async getUnreadCountRaw(
    userId: string,
    typeCondition: Prisma.Sql,
    siteCondition: Prisma.Sql,
    tenantCondition: Prisma.Sql,
  ): Promise<number> {
    const result = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM "notifications" n
      WHERE n."isRead" = false ${typeCondition}
      ${tenantCondition}
      AND (n."userId" = ${userId} OR (n."departmentId" = (SELECT "departmentId" FROM "User" WHERE "id" = ${userId}) ${siteCondition}))
    `;

    return Number(result[0]?.count || 0);
  }

  /** Build query filters for user notifications. */
  private buildUserWhere(
    userId: string,
    filters: Omit<NotificationFilters, "userId">,
  ): Prisma.NotificationsWhereInput {
    const where: Prisma.NotificationsWhereInput = { userId };

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.isRead !== undefined) {
      where.isRead = filters.isRead;
    }

    return where;
  }
}
