import { sendPushNotification as sendExpoPush, sendPushToDepartment as sendExpoPushToDepartment } from './ExpoPushService';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { socketEmitter } from '@/lib/websocket/emitter';
import { randomUUID } from 'crypto';
import { getPriorityEmoji, getStatusEmoji, getActionEmoji, getWorkOrderTypeLabel } from '@/lib/notification-constants';

export type NotificationType = 'WORK_ORDER' | 'SYSTEM' | 'TICKET' | 'ALERT' | 'ANNOUNCEMENT';
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface CreateNotificationData {
    type: NotificationType;
    priority?: NotificationPriority | undefined;
    title: string;
    message: string;
    link?: string | undefined;
    userId?: string | undefined;
    departmentId?: string | undefined;
    siteId?: string | undefined;
    sourceType?: string | undefined;
    sourceId?: string | undefined;
}

export interface WorkOrderNotificationData {
    workOrderId: string;
    workOrderNumber: string;
    title: string;
    type: string;
    priority: string;
    departmentId?: string | undefined;
    siteId?: string | undefined; // Added for strict filtering
    assignedToId?: string | undefined;
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
            link: data.link || null,
            userId: data.userId || null,
            departmentId: data.departmentId || null,
            siteId: data.siteId || null,
            sourceType: data.sourceType || null,
            sourceId: data.sourceId || null,
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
            link: data.link || undefined,
            sourceType: data.sourceType || undefined,
            sourceId: data.sourceId || undefined
        }).catch(err => console.error('[Expo Push] Error:', err));
    }

    // Emit to department if specified
    if (data.departmentId) {
        socketEmitter.notifyDepartment(data.departmentId, wsPayload);

        // Send Expo Push to all users in department
        sendExpoPushToDepartment(data.departmentId, data.title, data.message, {
            link: data.link || undefined,
            sourceType: data.sourceType || undefined,
            sourceId: data.sourceId || undefined
        }).catch(err => console.error('[Expo Push Dept] Error:', err));
    }

    // Also notify admins for important notifications
    if (data.priority === 'HIGH' || data.priority === 'URGENT' || data.type === 'ALERT') {
        socketEmitter.notifyAdmins(wsPayload, data.siteId);
    }

    return notification;
}


/**
 * Create notification for new Work Order (notify users by Department AND Site)
 */
/**
 * Helper to find eligible recipients for a notification based on Access Rights
 * 
 * Logic BARU (Site sebagai WAJIB):
 * 1. User Must be Active
 * 2. User must have 'workorders:read' permission  
 * 3. Site Access Check (WAJIB):
 *    - User HARUS punya akses ke site WO (via legacy siteId atau multi-site userSites)
 *    - Jika WO tidak punya siteId, maka semua user eligible
 * 4. Department Filter (Opsional):
 *    - Jika departmentId diset, hanya user di department tersebut
 */
async function findEligibleRecipients(departmentId?: string, siteId?: string, excludeUserId?: string) {
    if (!excludeUserId) {
        console.warn(`[NotificationDebug] WARNING: findEligibleRecipients called without excludeUserId. This may cause self-notifications.`);
    }
    console.log(`[NotificationDebug] Finding recipients for Dept: ${departmentId}, Site: ${siteId}, Exclude: ${excludeUserId || 'NONE'}`);

    // Build where clause
    const whereClause: Prisma.UserWhereInput = {
        isActive: true,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
        // Permission: Must have workorders:read
        role: {
            permission: {
                some: {
                    resource: 'workorders',
                    action: 'read'
                }
            }
        }
    };

    // SITE FILTER (WAJIB) - User harus punya akses ke site WO
    if (siteId) {
        whereClause.OR = [
            { siteId: siteId }, // Legacy: direct siteId match
            { siteId: null }, // Global user (no site restriction)
            { userSites: { some: { siteId: siteId } } } // Multi-site access
        ];
    }

    // DEPARTMENT FILTER (Opsional) - Jika department diset, filter user di department tsb
    if (departmentId) {
        whereClause.OR = whereClause.OR ? 
            // Combine with site filter
            whereClause.OR.map((condition: Prisma.UserWhereInput) => ({
                ...condition,
                OR: [
                    { departmentId: departmentId },
                    { departmentId: null }, // Global department user
                    {
                        role: {
                            permission: {
                                none: {
                                    resource: 'workorders',
                                    action: 'department_only'
                                }
                            }
                        }
                    }
                ]
            })) :
            // Only department filter  
            [
                { departmentId: departmentId },
                { departmentId: null },
                {
                    role: {
                        permission: {
                            none: {
                                resource: 'workorders',
                                action: 'department_only'
                            }
                        }
                    }
                }
            ];
    }
    
    const usersWithPermission = await prisma.user.findMany({
        where: whereClause,
        select: { 
            id: true,
            name: true,
            departmentId: true,
            siteId: true,
            userSites: {
                select: { siteId: true }
            },
            role: {
                select: {
                    name: true,
                    permission: {
                        where: {
                            resource: 'workorders',
                            action: 'site_only'
                        },
                        select: { id: true }
                    }
                }
            }
        }
    });

    // Additional filter for site_only permission
    const eligibleUsers = usersWithPermission.filter(user => {
        // Explicit exclusion safety net
        if (excludeUserId && user.id === excludeUserId) {
            console.log(`[NotificationDebug] Explicitly excluding user ${user.name} (${user.id})`);
            return false;
        }

        const hasSiteOnly = user.role?.permission && user.role.permission.length > 0;
        
        // User without site_only restriction can see all sites
        if (!hasSiteOnly) {
            return true;
        }
        
        // WO has no site → global WO, everyone can see
        if (!siteId) {
            return true;
        }
        
        // User HAS site_only restriction - verify site access
        const userSiteIds = user.userSites?.map(us => us.siteId) || [];
        const hasAccessViaSites = userSiteIds.includes(siteId);
        const hasAccessViaLegacy = user.siteId === siteId || user.siteId === null;
        
        const match = hasAccessViaSites || hasAccessViaLegacy;
        
        if (!match) {
            console.log(`[NotificationDebug] User ${user.name} rejected (Site Mismatch: UserSites=[${userSiteIds.join(',')}], LegacySite=${user.siteId} vs WOSite=${siteId})`);
        }
        return match;
    });

    console.log(`[NotificationDebug] Found ${eligibleUsers.length} eligible recipients`);
    return eligibleUsers.map(u => ({ id: u.id }));
}


/**
 * Create notification for new Work Order (notify users by Department AND Site)
 */
export async function notifyNewWorkOrder(data: WorkOrderNotificationData & { triggeredByUserId?: string }) {
    const priorityEmoji = getPriorityEmoji(data.priority);
    const typeLabel = getWorkOrderTypeLabel(data.type);

    console.log(`[NotificationDebug] Processing New WO Notification: ${data.workOrderNumber}`);
    const recipients = await findEligibleRecipients(data.departmentId, data.siteId, data.triggeredByUserId);
    
    console.log(`[Notification] New WO ${data.workOrderNumber}: Found ${recipients.length} recipients`);

    if (recipients.length === 0) {
        console.warn(`[NotificationDebug] NO RECIPIENTS FOUND for New WO ${data.workOrderNumber}. Check Dept/Site/Permissions.`);
        return null; 
    }

    const promises = recipients.map(async (user) => {
        const isAssignee = user.id === data.assignedToId;
        const personalizedTitle = isAssignee 
            ? `📋 Work Order Di-assign ke Anda`
            : `${priorityEmoji} Work Order Baru: ${data.workOrderNumber}`;

        await createNotification({
            type: 'WORK_ORDER',
            priority: data.priority as NotificationPriority,
            title: personalizedTitle,
            message: `[${typeLabel}] ${data.title}`,
            link: `/admin/workorders/${data.workOrderId}`,
            userId: user.id,
            siteId: data.siteId, // Pass siteId to store it
            sourceType: 'WORK_ORDER',
            sourceId: data.workOrderId,
        });
    });

    await Promise.all(promises);
    return { count: recipients.length };
}

/**
 * Create notification when Work Order is assigned to a user
 */
export async function notifyWorkOrderAssigned(data: WorkOrderNotificationData & { assigneeName?: string; triggeredByUserId?: string }) {
    // Notify Assignee
    if (data.assignedToId && data.assignedToId !== data.triggeredByUserId) {
        await createNotification({
            type: 'WORK_ORDER',
            priority: data.priority as NotificationPriority,
            title: `📋 Work Order Di-assign ke Anda`,
            message: `${data.workOrderNumber}: ${data.title}`,
            link: `/admin/workorders/${data.workOrderId}`,
            userId: data.assignedToId,
            siteId: data.siteId,
            sourceType: 'WORK_ORDER',
            sourceId: data.workOrderId,
        });
        // createNotification already sends Expo Push, no need for duplicate sendPushToUser
    }

    // Also notify Admins/Department (excluding assignee)
    const observers = await findEligibleRecipients(data.departmentId, data.siteId, data.assignedToId);
    
    await Promise.all(observers.map(user =>
        createNotification({
            type: 'WORK_ORDER',
            priority: 'NORMAL',
            title: `👤 Work Order Ditugaskan`,
            message: `${data.workOrderNumber} ditugaskan kepada ${data.assigneeName || 'user'}`,
            link: `/admin/workorders/${data.workOrderId}`,
            userId: user.id,
            siteId: data.siteId,
            sourceType: 'WORK_ORDER',
            sourceId: data.workOrderId,
        })
    ));
}

/**
 * Create notification for Work Order status change
 */
export async function notifyWorkOrderStatusChange(
    data: WorkOrderNotificationData & {
        oldStatus: string;
        newStatus: string;
        triggeredByUserId?: string;
    }
) {
    const statusEmoji = getStatusEmoji(data.newStatus);

    // Find recipients (exclude the person who triggered the action)
    const recipients = await findEligibleRecipients(data.departmentId, data.siteId, data.triggeredByUserId);
    
    await Promise.all(recipients.map(async (user) => {
        const isAssignee = user.id === data.assignedToId;
        const personalizedTitle = isAssignee ? `${statusEmoji} Status WO Anda Berubah` : `${statusEmoji} Status WO Berubah`;

        await createNotification({
            type: 'WORK_ORDER',
            priority: 'NORMAL',
            title: personalizedTitle,
            message: `${data.workOrderNumber}: ${data.oldStatus} → ${data.newStatus}`,
            link: `/admin/workorders/${data.workOrderId}`,
            userId: user.id,
            siteId: data.siteId,
            sourceType: 'WORK_ORDER',
            sourceId: data.workOrderId,
        });
        // createNotification already sends Expo Push, removed duplicate sendPushToUser
    }));
}

/**
 * Create notification for Work Order update/comment
 */
export async function notifyWorkOrderUpdate(
    data: WorkOrderNotificationData & {
        updateMessage: string;
        updatedByName?: string;
        triggeredByUserId?: string;
    }
) {
    // Notify Assignee + Admins/Department (exclude triggerer)
    const recipients = await findEligibleRecipients(data.departmentId, data.siteId, data.triggeredByUserId);

    await Promise.all(recipients.map(async (user) => {
        await createNotification({
            type: 'WORK_ORDER',
            priority: 'NORMAL',
            title: `💬 Update pada ${data.workOrderNumber}`,
            message: data.updateMessage,
            link: `/admin/workorders/${data.workOrderId}`,
            userId: user.id,
            siteId: data.siteId,
            sourceType: 'WORK_ORDER',
            sourceId: data.workOrderId,
        });
        // createNotification already sends Expo Push, removed duplicate sendPushToUser
    }));
}

/**
 * Notify Admin Portal users about mobile Work Order actions
 * This sends notifications to users who have workorders permission,
 * EXCLUDING the user who triggered the action (no self-notifications)
 */
export async function notifyAdminsAboutMobileAction(data: {
    workOrderId: string;
    workOrderNumber: string;
    title: string;
    actionType: 'CLAIM' | 'START' | 'COMPLETE' | 'PAUSE' | 'NOTE' | 'MATERIAL_PICKUP' | 'MATERIAL_RETURN' | 'PARTNER_INVITE' | 'PARTNER_RESPONSE' | 'COMMENT';
    actionMessage: string;
    triggeredByUserId: string;
    triggeredByName?: string;
    departmentId?: string;
    siteId?: string;
}) {
    const emoji = getActionEmoji(data.actionType);

    // Get admin users who should be notified (with workorders permission, excluding the triggerer)
    const adminUsersRaw = await findEligibleRecipients(data.departmentId, data.siteId, data.triggeredByUserId);
    
    // Explicitly filter again to be absolutely sure
    const adminUsers = adminUsersRaw.filter(u => u.id !== data.triggeredByUserId);

    console.log(`[Notification] Admin Action '${data.actionType}': Notifying ${adminUsers.length} users (Filtered out: ${adminUsersRaw.length - adminUsers.length})`);

    const promises = adminUsers.map(async (user) => {
        await createNotification({
            type: 'WORK_ORDER',
            priority: 'NORMAL',
            title: `${emoji} ${data.workOrderNumber}`,
            message: `${data.triggeredByName || 'Teknisi'}: ${data.actionMessage}`,
            link: `/admin/workorders/${data.workOrderId}`,
            userId: user.id,
            siteId: data.siteId,
            sourceType: 'WORK_ORDER',
            sourceId: data.workOrderId,
        });
    });

    await Promise.all(promises);
    console.log(`[Notification] Admin notified about mobile action: ${data.actionType} on ${data.workOrderNumber}`);
    return { count: adminUsers.length };
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
        excludeTypes?: NotificationType[];
        siteId?: string;
        departmentId?: string; // Add departmentId optimization
    }
) {
    // Optimization: Use provided departmentId to avoid DB query
    let userDepartmentId = options?.departmentId;

    if (!userDepartmentId) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { departmentId: true },
        });
        userDepartmentId = user?.departmentId || undefined;
    }

    const where: Prisma.NotificationsWhereInput = {
        OR: [
            { userId }, // Direct notifications
            {
                AND: [
                    { departmentId: userDepartmentId || 'NONE' },
                    options?.siteId ? { OR: [{ siteId: options.siteId }, { siteId: null }] } : {}
                ]
            }
        ],
    };

    if (options?.unreadOnly) {
        where.isRead = false;
    }

    if (options?.type) {
        where.type = options.type;
    }

    // Exclude specific types (e.g., WORK_ORDER from general notifications)
    if (options?.excludeTypes && options.excludeTypes.length > 0) {
        where.type = {
            notIn: options.excludeTypes
        };
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
 * OPTIMIZED: Uses single query with $queryRaw for better performance
 */
export async function getUnreadCount(userId: string, excludeTypes?: NotificationType[], siteId?: string): Promise<number> {
    // Build type exclusion condition safely using Prisma.sql and Prisma.join
    const typeCondition = excludeTypes && excludeTypes.length > 0
        ? Prisma.sql`AND "type" NOT IN (${Prisma.join(excludeTypes)})`
        : Prisma.empty;

    // Build site condition safely using parameterized query
    const siteCondition = siteId
        ? Prisma.sql`AND ("siteId" = ${siteId} OR "siteId" IS NULL)`
        : Prisma.empty;

    // Single optimized query with subquery for departmentId
    const result = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count
        FROM "notifications" n
        WHERE n."isRead" = false
        ${typeCondition}
        AND (
            n."userId" = ${userId}
            OR (
                n."departmentId" = (SELECT "departmentId" FROM "User" WHERE "id" = ${userId})
                ${siteCondition}
            )
        )
    `;

    return Number(result[0]?.count || 0);
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
export async function markAllAsRead(userId: string, type?: NotificationType, siteId?: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { departmentId: true },
    });

    const where: Prisma.NotificationsWhereInput = {
        isRead: false,
        OR: [
            { userId },
            {
                AND: [
                    { departmentId: user?.departmentId || 'NONE' },
                    siteId ? { OR: [{ siteId: siteId }, { siteId: null }] } : {}
                ]
            }
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
            userAgent: userAgent || null,
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

// Helper functions imported from @/lib/notification-constants

// ============================================
// CANVASING NOTIFICATIONS
// ============================================

export interface CanvasingNotificationData {
    canvasingId: string;
    customerName: string;
    salesId: string;
    salesName?: string;
    siteId?: string | null;
}

/**
 * Find users with canvasing:verify permission in a specific site
 */
async function findCanvasingVerifiers(siteId?: string | null): Promise<{ id: string }[]> {
    console.log(`[NotificationDebug] Finding canvasing verifiers for Site: ${siteId}`);

    const whereClause: Prisma.UserWhereInput = {
        isActive: true,
        role: {
            permission: {
                some: {
                    resource: 'canvasing',
                    action: 'verify'
                }
            }
        }
    };

    // Site filter - only notify users who have access to this site
    if (siteId) {
        whereClause.OR = [
            { siteId: siteId },
            { siteId: null }, // Global users (no site restriction)
            { userSites: { some: { siteId: siteId } } }
        ];
    }

    const users = await prisma.user.findMany({
        where: whereClause,
        select: { id: true, name: true }
    });

    console.log(`[NotificationDebug] Found ${users.length} canvasing verifiers`);
    return users;
}

/**
 * Notify admins/managers about new canvasing request
 */
export async function notifyNewCanvasing(data: CanvasingNotificationData) {
    console.log(`[NotificationDebug] Processing New Canvasing Notification for: ${data.customerName}`);

    const recipients = await findCanvasingVerifiers(data.siteId);

    if (recipients.length === 0) {
        console.warn(`[NotificationDebug] NO RECIPIENTS FOUND for New Canvasing. Check permissions.`);
        return null;
    }

    const promises = recipients.map(async (user) => {
        await createNotification({
            type: 'ANNOUNCEMENT',
            priority: 'NORMAL',
            title: '📋 Canvasing Baru',
            message: `Request canvasing baru untuk ${data.customerName} dari ${data.salesName || 'Sales'}`,
            link: `/admin/marketing/canvasing/${data.canvasingId}`,
            userId: user.id,
            siteId: data.siteId || undefined,
            sourceType: 'CANVASING',
            sourceId: data.canvasingId,
        });
    });

    await Promise.all(promises);
    console.log(`[Notification] New Canvasing: Notified ${recipients.length} verifiers`);
    return { count: recipients.length };
}
