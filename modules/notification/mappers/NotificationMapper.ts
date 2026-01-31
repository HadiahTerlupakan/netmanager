/**
 * NotificationMapper
 *
 * Transforms Prisma entities to DTOs for API responses.
 */

import type {
    NotificationListItemDTO,
    NotificationDetailDTO,
    NotificationCountDTO,
} from '../dto/NotificationDTO'

// Types based on common notification structure
interface Notification {
    id: string
    userId: string
    title: string
    message: string
    type: string
    isRead: boolean
    data?: unknown
    createdAt: Date
    readAt?: Date | null
}

export class NotificationMapper {
    /**
     * Map to list item DTO
     */
    static toListItem(entity: Notification): NotificationListItemDTO {
        return {
            id: entity.id,
            title: entity.title,
            message: entity.message,
            type: entity.type,
            isRead: entity.isRead,
            createdAt: entity.createdAt.toISOString(),
        }
    }

    /**
     * Map array to list items
     */
    static toListItems(entities: Notification[]): NotificationListItemDTO[] {
        return entities.map(entity => this.toListItem(entity))
    }

    /**
     * Map to detail DTO
     */
    static toDetail(entity: Notification): NotificationDetailDTO {
        return {
            id: entity.id,
            title: entity.title,
            message: entity.message,
            type: entity.type,
            isRead: entity.isRead,
            data: this.parseData(entity.data),
            createdAt: entity.createdAt.toISOString(),
            readAt: entity.readAt?.toISOString() ?? null,
        }
    }

    /**
     * Calculate notification counts
     */
    static toCount(entities: Notification[]): NotificationCountDTO {
        return {
            total: entities.length,
            unread: entities.filter(e => !e.isRead).length,
        }
    }

    // ==================== Private Helpers ====================

    private static parseData(value: unknown): Record<string, unknown> | null {
        if (!value) return null
        if (typeof value === 'string') {
            try {
                return JSON.parse(value)
            } catch {
                return null
            }
        }
        return value as Record<string, unknown>
    }
}
