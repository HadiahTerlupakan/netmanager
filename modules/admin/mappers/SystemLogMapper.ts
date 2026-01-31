/**
 * SystemLogMapper
 *
 * Transforms Prisma entities to DTOs for API responses.
 */

import type { SystemLog } from '@prisma/client'
import type {
    SystemLogListItemDTO,
    SystemLogDetailDTO,
    ActivityTimelineDTO,
} from '../dto/SystemLogDTO'

// Extended types
type SystemLogWithUser = SystemLog & {
    user?: {
        id: string
        name: string | null
        email: string
    } | null
}

export class SystemLogMapper {
    /**
     * Map to list item DTO
     */
    static toListItem(entity: SystemLogWithUser): SystemLogListItemDTO {
        return {
            id: entity.id,
            type: entity.type,
            action: entity.action,
            subject: entity.subject,
            createdAt: entity.createdAt.toISOString(),
            userName: entity.user?.name ?? null,
            userEmail: entity.user?.email ?? null,
        }
    }

    /**
     * Map array to list items
     */
    static toListItems(entities: SystemLogWithUser[]): SystemLogListItemDTO[] {
        return entities.map(entity => this.toListItem(entity))
    }

    /**
     * Map to detail DTO
     */
    static toDetail(entity: SystemLogWithUser): SystemLogDetailDTO {
        // Parse details JSON if string
        let details: Record<string, unknown> | null = null
        if (entity.details) {
            if (typeof entity.details === 'string') {
                try {
                    details = JSON.parse(entity.details)
                } catch {
                    details = { raw: entity.details }
                }
            } else {
                details = entity.details as Record<string, unknown>
            }
        }

        return {
            id: entity.id,
            type: entity.type,
            action: entity.action,
            subject: entity.subject,
            details,
            createdAt: entity.createdAt.toISOString(),
            user: entity.user ? {
                id: entity.user.id,
                name: entity.user.name,
                email: entity.user.email,
            } : null,
            request: {
                ipAddress: entity.ipAddress,
                userAgent: entity.userAgent,
            },
        }
    }

    /**
     * Map to activity timeline DTO (for dashboard)
     */
    static toTimeline(entity: SystemLogWithUser): ActivityTimelineDTO {
        return {
            id: entity.id,
            action: entity.action,
            subject: entity.subject,
            description: this.buildDescription(entity),
            createdAt: entity.createdAt.toISOString(),
            user: entity.user ? {
                name: entity.user.name,
            } : null,
        }
    }

    /**
     * Map array to timeline DTOs
     */
    static toTimelineList(entities: SystemLogWithUser[]): ActivityTimelineDTO[] {
        return entities.map(entity => this.toTimeline(entity))
    }

    // ==================== Private Helpers ====================

    /**
     * Build human-readable description from log
     */
    private static buildDescription(log: SystemLogWithUser): string {
        const actionMap: Record<string, string> = {
            'CREATE': 'membuat',
            'UPDATE': 'mengupdate',
            'DELETE': 'menghapus',
            'LOGIN': 'login ke',
            'LOGOUT': 'logout dari',
            'ASSIGN': 'menetapkan',
            'APPROVE': 'menyetujui',
            'REJECT': 'menolak',
            'STATUS_CHANGE': 'mengubah status',
        }

        const action = actionMap[log.action] ?? log.action.toLowerCase()
        const subject = log.subject.replace(/_/g, ' ').toLowerCase()
        const userName = log.user?.name ?? 'System'

        return `${userName} ${action} ${subject}`
    }

    /**
     * Format action for display
     */
    static formatAction(action: string): string {
        const actionLabels: Record<string, string> = {
            'CREATE': 'Buat',
            'UPDATE': 'Update',
            'DELETE': 'Hapus',
            'LOGIN': 'Login',
            'LOGOUT': 'Logout',
            'ASSIGN': 'Assign',
            'APPROVE': 'Approve',
            'REJECT': 'Reject',
            'STATUS_CHANGE': 'Status Change',
        }
        return actionLabels[action] ?? action
    }

    /**
     * Get action color for UI
     */
    static getActionColor(action: string): string {
        const colors: Record<string, string> = {
            'CREATE': 'green',
            'UPDATE': 'blue',
            'DELETE': 'red',
            'LOGIN': 'cyan',
            'LOGOUT': 'gray',
            'ASSIGN': 'purple',
            'APPROVE': 'green',
            'REJECT': 'red',
            'STATUS_CHANGE': 'orange',
        }
        return colors[action] ?? 'gray'
    }
}
