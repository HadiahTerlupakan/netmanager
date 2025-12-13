import { sendPushNotifications, type PushPayload } from './PushNotificationService';
import { prisma } from '@/lib/prisma';
import type { PushSubscription } from '@prisma/client';

export type NotificationType = 'WORK_ORDER' | 'SYSTEM' | 'TICKET' | 'ALERT';
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface CreateNotificationData {
    type: NotificationType;
    priority?: NotificationPriority;
    title: string;
    message: string;
    link?: string;
    employeeId?: string;
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
    assignedToId?: string;
}

/**
 * Create a notification in the database
 */
export async function createNotification(data: CreateNotificationData) {
    return prisma.notification.create({
        data: {
            type: data.type,
            priority: data.priority || 'NORMAL',
            title: data.title,
            message: data.message,
            link: data.link,
            employeeId: data.employeeId,
            departmentId: data.departmentId,
            sourceType: data.sourceType,
            sourceId: data.sourceId,
        },
    });
}

/**
 * Send push notification to an employee
 */
async function sendPushToEmployee(employeeId: string, payload: PushPayload) {
    const subscriptions = await prisma.pushSubscription.findMany({
        where: {
            employeeId,
            isActive: true,
        },
    });

    if (subscriptions.length === 0) return [];

    const results = await sendPushNotifications(
        subscriptions.map((sub: PushSubscription) => ({
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
        await prisma.pushSubscription.updateMany({
            where: {
                endpoint: { in: expiredEndpoints },
            },
            data: {
                isActive: false,
            },
        });
    }

    return results;
}

/**
 * Send push notification to all employees in a department
 */
async function sendPushToDepartment(departmentId: string, payload: PushPayload) {
    const employees = await prisma.employee.findMany({
        where: {
            departmentId,
            isActive: true,
        },
        select: {
            id: true,
        },
    });

    const results = await Promise.all(
        employees.map((emp) => sendPushToEmployee(emp.id, payload))
    );

    return results.flat();
}

/**
 * Create notification for new Work Order (notify all department employees)
 */
export async function notifyNewWorkOrder(data: WorkOrderNotificationData) {
    const priorityEmoji = getPriorityEmoji(data.priority);
    const typeLabel = getWorkOrderTypeLabel(data.type);

    const notification = await createNotification({
        type: 'WORK_ORDER',
        priority: data.priority as NotificationPriority,
        title: `${priorityEmoji} Work Order Baru: ${data.workOrderNumber}`,
        message: `[${typeLabel}] ${data.title}`,
        link: `/employee/workorders?id=${data.workOrderId}`,
        departmentId: data.departmentId,
        sourceType: 'WORK_ORDER',
        sourceId: data.workOrderId,
    });

    // Send push to department
    if (data.departmentId) {
        await sendPushToDepartment(data.departmentId, {
            title: `${priorityEmoji} Work Order Baru`,
            body: `[${typeLabel}] ${data.title}`,
            data: {
                url: `/employee/workorders?id=${data.workOrderId}`,
                type: 'WORK_ORDER',
                sourceId: data.workOrderId,
            },
            tag: `wo-new-${data.workOrderId}`,
            requireInteraction: data.priority === 'URGENT' || data.priority === 'HIGH',
        });
    }

    return notification;
}

/**
 * Create notification when Work Order is assigned to a technician
 */
export async function notifyWorkOrderAssigned(data: WorkOrderNotificationData & { assigneeName?: string }) {
    if (!data.assignedToId) return null;

    const notification = await createNotification({
        type: 'WORK_ORDER',
        priority: data.priority as NotificationPriority,
        title: `📋 Work Order Di-assign ke Anda`,
        message: `${data.workOrderNumber}: ${data.title}`,
        link: `/employee/workorders?id=${data.workOrderId}`,
        employeeId: data.assignedToId,
        sourceType: 'WORK_ORDER',
        sourceId: data.workOrderId,
    });

    // Send push to assigned employee
    await sendPushToEmployee(data.assignedToId, {
        title: '📋 Work Order Di-assign ke Anda',
        body: `${data.workOrderNumber}: ${data.title}`,
        data: {
            url: `/employee/workorders?id=${data.workOrderId}`,
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
        link: `/employee/workorders?id=${data.workOrderId}`,
        employeeId: data.assignedToId,
        sourceType: 'WORK_ORDER',
        sourceId: data.workOrderId,
    });

    // Send push to assigned employee
    await sendPushToEmployee(data.assignedToId, {
        title: `${statusEmoji} Status WO Berubah: ${statusLabel}`,
        body: `${data.workOrderNumber}: ${data.title}`,
        data: {
            url: `/employee/workorders?id=${data.workOrderId}`,
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
        link: `/employee/workorders?id=${data.workOrderId}`,
        employeeId: data.assignedToId,
        sourceType: 'WORK_ORDER',
        sourceId: data.workOrderId,
    });

    // Send push to assigned employee
    await sendPushToEmployee(data.assignedToId, {
        title: `💬 Update pada ${data.workOrderNumber}`,
        body: data.updateMessage,
        data: {
            url: `/employee/workorders?id=${data.workOrderId}`,
            type: 'WORK_ORDER',
            sourceId: data.workOrderId,
        },
        tag: `wo-update-${data.workOrderId}`,
    });

    return notification;
}

/**
 * Get notifications for an employee (including department notifications)
 */
export async function getNotificationsForEmployee(
    employeeId: string,
    options?: {
        unreadOnly?: boolean;
        limit?: number;
        offset?: number;
    }
) {
    // Get employee's department
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { departmentId: true },
    });

    const where: any = {
        OR: [
            { employeeId },
            ...(employee?.departmentId ? [{ departmentId: employee.departmentId }] : []),
        ],
    };

    if (options?.unreadOnly) {
        where.isRead = false;
    }

    const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: options?.limit || 50,
            skip: options?.offset || 0,
        }),
        prisma.notification.count({ where }),
    ]);

    return { notifications, total };
}

/**
 * Get unread notification count for an employee
 */
export async function getUnreadCount(employeeId: string): Promise<number> {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { departmentId: true },
    });

    return prisma.notification.count({
        where: {
            isRead: false,
            OR: [
                { employeeId },
                ...(employee?.departmentId ? [{ departmentId: employee.departmentId }] : []),
            ],
        },
    });
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId: string) {
    return prisma.notification.update({
        where: { id: notificationId },
        data: {
            isRead: true,
            readAt: new Date(),
        },
    });
}

/**
 * Mark all notifications as read for an employee
 */
export async function markAllAsRead(employeeId: string) {
    const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { departmentId: true },
    });

    return prisma.notification.updateMany({
        where: {
            isRead: false,
            OR: [
                { employeeId },
                ...(employee?.departmentId ? [{ departmentId: employee.departmentId }] : []),
            ],
        },
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
    employeeId: string,
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
    const existing = await prisma.pushSubscription.findUnique({
        where: { endpoint: subscription.endpoint },
    });

    if (existing) {
        return prisma.pushSubscription.update({
            where: { endpoint: subscription.endpoint },
            data: {
                isActive: true,
                updatedAt: new Date(),
            },
        });
    }

    return prisma.pushSubscription.create({
        data: {
            employeeId,
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
    return prisma.pushSubscription.updateMany({
        where: { endpoint },
        data: { isActive: false },
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
