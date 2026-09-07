/**
 * NotificationMapper
 *
 * Transforms Prisma rows into domain entities and DTOs.
 */

import type { Notifications } from "@prisma/client";
import type { NotificationEntity } from "../domain/entities/NotificationEntity";

export class NotificationMapper {
  /** Map Prisma notification row to domain entity. */
  static toDomain(record: Notifications): NotificationEntity {
    return {
      id: record.id,
      type: record.type,
      priority: record.priority,
      title: record.title,
      message: record.message,
      link: record.link,
      isRead: record.isRead,
      userId: record.userId,
      departmentId: record.departmentId,
      sourceType: record.sourceType,
      sourceId: record.sourceId,
      createdAt: record.createdAt,
      readAt: record.readAt,
      siteId: record.siteId,
      tenantId: record.tenantId,
    };
  }

  /** Map many Prisma notification rows to domain entities. */
  static toDomainList(records: Notifications[]): NotificationEntity[] {
    return records.map((record) => this.toDomain(record));
  }
}
