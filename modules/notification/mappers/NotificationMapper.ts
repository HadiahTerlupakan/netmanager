/**
 * NotificationMapper
 *
 * Transforms Prisma rows into domain entities and DTOs.
 */

import type { Notifications } from "@prisma/client";
import type {
  NotificationCountDTO,
  NotificationDetailDTO,
  NotificationListItemDTO,
} from "../dto/NotificationDTO";
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

  /** Map domain entity to list DTO. */
  static toListItem(entity: NotificationEntity): NotificationListItemDTO {
    return {
      id: entity.id,
      title: entity.title,
      message: entity.message,
      type: entity.type,
      isRead: entity.isRead,
      createdAt: entity.createdAt.toISOString(),
    };
  }

  /** Map many domain entities to list DTOs. */
  static toListItems(
    entities: NotificationEntity[],
  ): NotificationListItemDTO[] {
    return entities.map((entity) => this.toListItem(entity));
  }

  /** Map domain entity to detail DTO. */
  static toDetail(entity: NotificationEntity): NotificationDetailDTO {
    return {
      id: entity.id,
      title: entity.title,
      message: entity.message,
      type: entity.type,
      isRead: entity.isRead,
      data: null,
      createdAt: entity.createdAt.toISOString(),
      readAt: entity.readAt?.toISOString() ?? null,
    };
  }

  /** Map notification entities to count DTO. */
  static toCount(entities: NotificationEntity[]): NotificationCountDTO {
    return {
      total: entities.length,
      unread: entities.filter((entity) => !entity.isRead).length,
    };
  }
}
