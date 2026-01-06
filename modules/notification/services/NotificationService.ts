import { sendPushNotifications, type PushPayload } from './PushNotificationService';
import { sendPushNotification as sendExpoPush, sendPushToDepartment as sendExpoPushToDepartment } from './ExpoPushService';
import { prisma } from '@/lib/prisma';
import type { PushSubscriptions } from '@prisma/client';
import { socketEmitter } from '@/lib/websocket/emitter';
import { randomUUID } from 'crypto';

export type NotificationType = 'WORK_ORDER' | 'SYSTEM' | 'TICKET' | 'ALERT' | 'ANNOUNCEMENT';
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface CreateNotificationData {
    type: NotificationType;
    priority?: NotificationPriority;
    title: string;
    message: string;
    link?: string;
    userId?: string;
    departmentId?: string;
    sourceType?: string;
    sourceId?: string;
}

export interface WorkOrderNotificationData {
    workOrderId: string;
    workOrderNumber: string;
    title: string;
    type: string;
    priority: string;
    departmentId?: string;
    siteId?: string; // Added for strict filtering
    assignedToId?: string;
}

/**
 * Create a notification in the database and emit WebSocket event
 */
export async function createNotification(data: CreateNotificationData) {
    const notification = await prisma.notifications.create({
        data: {
            id: randomUUID(),
            type: data.type,
            priority: data.priority || 'NORMAL',
            title: data.title,
            message: data.message,
            link: data.link,
            userId: data.userId,
            departmentId: data.departmentId,
            sourceType: data.sourceType,
            sourceId: data.sourceId,
        },
    });

    // Prepare WebSocket payload
    const wsPayload = {
        id: notification.id,
        type: notification.type,
        priority: notification.priority,
        title: notification.title,
        message: notification.message,
        link: notification.link || undefined,
        createdAt: notification.createdAt.toISOString(),
    };

    // Emit WebSocket event to specific user
    if (data.userId) {
        socketEmitter.notifyUser(data.userId, wsPayload);

        // Send Expo Push notification for mobile users
        sendExpoPush(data.userId, data.title, data.message, {
            link: data.link,
            sourceType: data.sourceType,
            sourceId: data.sourceId
        }).catch(err => console.error('[Expo Push] Error:', err));
    }

    // Emit to department if specified
    if (data.departmentId) {
        socketEmitter.notifyDepartment(data.departmentId, wsPayload);

        // Send Expo Push to all users in department
        sendExpoPushToDepartment(data.departmentId, data.title, data.message, {
            link: data.link,
            sourceType: data.sourceType,
            sourceId: data.sourceId
        }).catch(err => console.error('[Expo Push Dept] Error:', err));
    }

    // Also notify admins for important notifications
    if (data.priority === 'HIGH' || data.priority === 'URGENT' || data.type === 'ALERT') {
        socketEmitter.notifyAdmins(wsPayload);
    }

    return notification;
}


/**
 * Send push notification to a user
 */
async function sendPushToUser(userId: string, payload: PushPayload) {
    const subscriptions = await prisma.pushSubscriptions.findMany({
        where: {
            userId,
            isActive: true,
        },
    });

    if (subscriptions.length === 0) return [];

    const results = await sendPushNotifications(
        subscriptions.map((sub: PushSubscriptions) => ({
            endpoint: sub.endpoint,
            keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
            },
        })),
        payload
    );

    // Deactivate expired subscriptions
    const expiredEndpoints = results
        .filter((r) => !r.success && r.error?.includes('expired'))
        .map((r) => r.endpoint);

    if (expiredEndpoints.length > 0) {
        await prisma.pushSubscriptions.updateMany({
            where: {
                endpoint: { in: expiredEndpoints },
            },
            data: {
                isActive: false,
                updatedAt: new Date(),
            },
        });
    }

    return results;
}

/**
 * Send push notification to all users in a department
 */
async function sendPushToDepartment(departmentId: string, payload: PushPayload) {
    const users = await prisma.user.findMany({
        where: {
            departmentId,
            isActive: true,
        },
        select: {
            id: true,
        },
    });

    const results = await Promise.all(
        users.map((user) => sendPushToUser(user.id, payload))
    );

    return results.flat();
}

/**
 * Create notification for new Work Order (notify users by Department AND Site)
 */
export async function notifyNewWorkOrder(data: WorkOrderNotificationData) {
    const priorityEmoji = getPriorityEmoji(data.priority);
    const typeLabel = getWorkOrderTypeLabel(data.type);

    // 1. Find all eligible users
    // Logic: User must match Dept AND Site
    const whereCondition: any = {
        isActive: true, // Only active users
        AND: [
            // Department Filter
            data.departmentId
                ? { OR: [{ departmentId: null }, { departmentId: data.departmentId }] }
                : { departmentId: null }, // If user has no dept, can see global

            // Site Filter
            data.siteId
                ? { OR: [{ siteId: null }, { siteId: data.siteId }] }
                : { siteId: null } // If user has no site, can see global
        ]
    };

    // However, if WO has NO Department, it's global? (Usually WO has Dept)
    // Let's refine based on the STRICT logic we defined in API:
    // API GET logic:
    // user.deptId must permit WO.deptId -> (wo.dept is null OR wo.dept == user.dept)
    // user.siteId must permit WO.siteId -> (wo.site is null OR wo.site == user.site)
    // Here we have WO, seeking Users.
    // User is eligible if:
    // (User.dept == WO.dept OR User.dept == NULL [if we treat null dept as super-admin/all-access? NO, usually null dept is strict])
    // WAIT. API Logic was: User sees WO if (User.Dept == WO.Dept OR WO.Dept == Null).
    // So here: Find Users where (User.Dept == WO.Dept OR User.Dept == ?) -> No, we want users who CAN see this WO.
    // User can see if: (User.Dept == WO.Dept) || (WO.Dept == NULL) -- If WO.Dept is NULL, ALL users with matching Site can see.
    // So query:
    // If WO.Dept is NOT NULL: User.Dept MUST be WO.Dept. (Or User is Admin? We ignore role checks for now, assumtion is finding target workers)
    // If WO.Site is NOT NULL: User.Site MUST be WO.Site.
    
    // Revised Query Construction:
    const criteria: any = { isActive: true };

    if (data.departmentId) {
        criteria.departmentId = data.departmentId;
    }
    // If data.departmentId is null, we notify all departments? Or specific "Global" users?
    // Let's assume if WO has no dept, it notifies EVERYONE (filtered by site).

    if (data.siteId) {
        criteria.siteId = data.siteId;
    }
    // If data.siteId is null, notify users of ALL sites? 
    // Usually WO always has site. If null, maybe only users with null site?
    // Let's stick to strict matching. User must match properties if they exist on WO.

    // Correction: Notification logic often wants to be broader than API access. 
    // But user asked for "Strict like API".
    // API: User sees WO if user matches WO.
    // So here: Find User where User.Dept == WO.Dept AND User.Site == WO.Site.
    // What about User with Null Dept? Null Dept usually means broken record or special. 
    // What about User with Null Site? Null Site usually means "Head Office" or "Global".
    // If WO is Site A. User is Site Null.
    // API logic: siteFilter = { siteId: { in: [null, user.siteId] } }.
    // Meaning User(Null) asks for Site(Null). User(Null) CANNOT see Site(A).
    // So User(Null) should NOT get notification for Site(A).
    // Correct.
    
    // Implementation:
    const users = await prisma.user.findMany({
        where: criteria,
        select: { id: true }
    });

    if (users.length === 0) return null;

    // 2. Send notification to each user individually
    const promises = users.map(async (user) => {
        // DB Notification
        await createNotification({
            type: 'WORK_ORDER',
            priority: data.priority as NotificationPriority,
            title: `${priorityEmoji} Work Order Baru: ${data.workOrderNumber}`,
            message: `[${typeLabel}] ${data.title}`,
            link: `/admin/workorders/${data.workOrderId}`,
            userId: user.id, // Targeting specific user
            sourceType: 'WORK_ORDER',
            sourceId: data.workOrderId,
        });

        // Push Notification (Direct to User)
        // Note: createNotification already handles push to user if userId is provided!
        // So we don't need to call sendPushToUser manually here anymore.
    });

    await Promise.all(promises);

    return { count: users.length };
}

/**
 * Create notification when Work Order is assigned to a user
 */
export async function notifyWorkOrderAssigned(data: WorkOrderNotificationData & { assigneeName?: string }) {
    if (!data.assignedToId) return null;

    const notification = await createNotification({
        type: 'WORK_ORDER',
        priority: data.priority as NotificationPriority,
        title: `📋 Work Order Di-assign ke Anda`,
        message: `${data.workOrderNumber}: ${data.title}`,
        link: `/admin/workorders/${data.workOrderId}`,
        userId: data.assignedToId,
        sourceType: 'WORK_ORDER',
        sourceId: data.workOrderId,
    });

    // Send push to assigned user
    await sendPushToUser(data.assignedToId, {
        title: '📋 Work Order Di-assign ke Anda',
        body: `${data.workOrderNumber}: ${data.title}`,
        data: {
            url: `/admin/workorders/${data.workOrderId}`,
            type: 'WORK_ORDER',
            sourceId: data.workOrderId,
        },
        tag: `wo-assigned-${data.workOrderId}`,
        requireInteraction: true,
    });

    return notification;
}

/**
 * Create notification for Work Order status change
 */
export async function notifyWorkOrderStatusChange(
    data: WorkOrderNotificationData & {
        oldStatus: string;
        newStatus: string;
    }
) {
    if (!data.assignedToId) return null;

    const statusLabel = getStatusLabel(data.newStatus);
    const statusEmoji = getStatusEmoji(data.newStatus);

    const notification = await createNotification({
        type: 'WORK_ORDER',
        priority: 'NORMAL',
        title: `${statusEmoji} Status WO Berubah`,
        message: `${data.workOrderNumber}: ${data.oldStatus} → ${data.newStatus}`,
        link: `/admin/workorders/${data.workOrderId}`,
        userId: data.assignedToId,
        sourceType: 'WORK_ORDER',
        sourceId: data.workOrderId,
    });

    // Send push to assigned user
    await sendPushToUser(data.assignedToId, {
        title: `${statusEmoji} Status WO Berubah: ${statusLabel}`,
        body: `${data.workOrderNumber}: ${data.title}`,
        data: {
            url: `/admin/workorders/${data.workOrderId}`,
            type: 'WORK_ORDER',
            sourceId: data.workOrderId,
        },
        tag: `wo-status-${data.workOrderId}`,
    });

    return notification;
}

/**
 * Create notification for Work Order update/comment
 */
export async function notifyWorkOrderUpdate(
    data: WorkOrderNotificationData & {
        updateMessage: string;
        updatedByName?: string;
    }
) {
    if (!data.assignedToId) return null;

    const notification = await createNotification({
        type: 'WORK_ORDER',
        priority: 'NORMAL',
        title: `💬 Update pada ${data.workOrderNumber}`,
        message: data.updateMessage,
        link: `/admin/workorders/${data.workOrderId}`,
        userId: data.assignedToId,
        sourceType: 'WORK_ORDER',
        sourceId: data.workOrderId,
    });

    // Send push to assigned user
    await sendPushToUser(data.assignedToId, {
        title: `💬 Update pada ${data.workOrderNumber}`,
        body: data.updateMessage,
        data: {
            url: `/admin/workorders/${data.workOrderId}`,
            type: 'WORK_ORDER',
            sourceId: data.workOrderId,
        },
        tag: `wo-update-${data.workOrderId}`,
    });

    return notification;
}

/**
 * Get notifications for a user (including department notifications)
 */
export async function getNotificationsForUser(
    userId: string,
    options?: {
        unreadOnly?: boolean;
        limit?: number;
        offset?: number;
        type?: NotificationType;
    }
) {
    // Get user's department
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
    });

    const where: any = {
        OR: [
            { userId },
            ...(user?.departmentId ? [{ departmentId: user.departmentId }] : []),
        ],
    };

    if (options?.unreadOnly) {
        where.isRead = false;
    }

    if (options?.type) {
        where.type = options.type;
    }

    const [notifications, total] = await Promise.all([
        prisma.notifications.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: options?.limit || 50,
            skip: options?.offset || 0,
        }),
        prisma.notifications.count({ where }),
    ]);

    return { notifications, total };
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
    });

    return prisma.notifications.count({
        where: {
            isRead: false,
            OR: [
                { userId },
                ...(user?.departmentId ? [{ departmentId: user.departmentId }] : []),
            ],
        },
    });
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId: string) {
    return prisma.notifications.update({
        where: { id: notificationId },
        data: {
            isRead: true,
            readAt: new Date(),
        },
    });
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string, type?: NotificationType) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
    });

    const where: any = {
        isRead: false,
        OR: [
            { userId },
            ...(user?.departmentId ? [{ departmentId: user.departmentId }] : []),
        ],
    };

    if (type) {
        where.type = type;
    }

    return prisma.notifications.updateMany({
        where,
        data: {
            isRead: true,
            readAt: new Date(),
        },
    });
}

/**
 * Subscribe device for push notifications
 */
export async function subscribeDevice(
    userId: string,
    subscription: {
        endpoint: string;
        keys: {
            p256dh: string;
            auth: string;
        };
    },
    userAgent?: string
) {
    // Check if already exists
    const existing = await prisma.pushSubscriptions.findUnique({
        where: { endpoint: subscription.endpoint },
    });

    if (existing) {
        return prisma.pushSubscriptions.update({
            where: { endpoint: subscription.endpoint },
            data: {
                isActive: true,
                updatedAt: new Date(),
            },
        });
    }

    return prisma.pushSubscriptions.create({
        data: {
            id: randomUUID(),
            updatedAt: new Date(),
            userId,
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            userAgent,
        },
    });
}

/**
 * Unsubscribe device from push notifications
 */
export async function unsubscribeDevice(endpoint: string) {
    return prisma.pushSubscriptions.updateMany({
        where: { endpoint },
        data: { 
            isActive: false,
            updatedAt: new Date(),
        },
    });
}

// Helper functions
function getPriorityEmoji(priority: string): string {
    switch (priority) {
        case 'URGENT':
        case 'CRITICAL':
            return '🚨';
        case 'HIGH':
            return '⚠️';
        case 'NORMAL':
            return '📋';
        case 'LOW':
            return '📝';
        default:
            return '📋';
    }
}

function getWorkOrderTypeLabel(type: string): string {
    const labels: Record<string, string> = {
        INSTALLATION: 'Instalasi',
        TROUBLESHOOT: 'Troubleshoot',
        MAINTENANCE: 'Maintenance',
        DISCONNECTION: 'Penarikan',
        RELOCATION: 'Relokasi',
    };
    return labels[type] || type;
}

function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
        PENDING: 'Menunggu',
        ASSIGNED: 'Ditugaskan',
        IN_PROGRESS: 'Dikerjakan',
        COMPLETED: 'Selesai',
        VERIFIED: 'Terverifikasi',
        CLOSED: 'Ditutup',
        CANCELLED: 'Dibatalkan',
        ON_HOLD: 'Ditunda',
    };
    return labels[status] || status;
}

function getStatusEmoji(status: string): string {
    switch (status) {
        case 'COMPLETED':
            return '✅';
        case 'VERIFIED':
            return '✔️';
        case 'CLOSED':
            return '🔒';
        case 'CANCELLED':
            return '❌';
        case 'IN_PROGRESS':
            return '🔄';
        case 'ON_HOLD':
            return '⏸️';
        case 'ASSIGNED':
            return '👤';
        default:
            return '📋';
    }
}
