/**
 * Notification display constants
 * Used by both service layer (for push notification text) and frontend components
 */

export const PRIORITY_EMOJI: Record<string, string> = {
    URGENT: '🚨',
    CRITICAL: '🚨',
    HIGH: '⚠️',
    NORMAL: '📋',
    LOW: '📝',
}

export const STATUS_EMOJI: Record<string, string> = {
    COMPLETED: '✅',
    VERIFIED: '✔️',
    CLOSED: '🔒',
    CANCELLED: '❌',
    IN_PROGRESS: '🔄',
    ON_HOLD: '⏸️',
    ASSIGNED: '👤',
}

export const ACTION_EMOJI: Record<string, string> = {
    CLAIM: '🎯',
    START: '▶️',
    COMPLETE: '✅',
    PAUSE: '⏸️',
    NOTE: '📝',
    MATERIAL_PICKUP: '📦',
    MATERIAL_RETURN: '📥',
    PARTNER_INVITE: '🤝',
    PARTNER_RESPONSE: '📨',
    COMMENT: '💬',
}

export const WORKORDER_TYPE_LABELS: Record<string, string> = {
    INSTALLATION: 'Instalasi',
    TROUBLESHOOT: 'Troubleshoot',
    MAINTENANCE: 'Maintenance',
    DISCONNECTION: 'Penarikan',
    RELOCATION: 'Relokasi',
}

export function getPriorityEmoji(priority: string): string {
    return PRIORITY_EMOJI[priority] || '📋'
}

export function getStatusEmoji(status: string): string {
    return STATUS_EMOJI[status] || '📋'
}

export function getActionEmoji(action: string): string {
    return ACTION_EMOJI[action] || '📋'
}

export function getWorkOrderTypeLabel(type: string): string {
    return WORKORDER_TYPE_LABELS[type] || type
}
