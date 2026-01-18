/**
 * Work Order Notification Integration
 * 
 * This module handles notification triggers when work order events occur.
 * It's designed to be called from API routes after work order operations.
 */

import {
    notifyNewWorkOrder,
    notifyWorkOrderAssigned,
    notifyWorkOrderStatusChange,
    notifyWorkOrderUpdate,
    createNotification,
} from '@/modules/notification';
import { prisma } from '@/lib/prisma';
import { sendPushToDepartment, sendPushToUsers } from '@/modules/notification/services/ExpoPushService';

interface WorkOrderData {
    id: string;
    workOrderNumber: string;
    title: string;
    type: string;
    priority: string;
    departmentId?: string | null;
    siteId?: string | null;
    assignedToId?: string | null;
}

/**
 * Trigger notification when a new Work Order is created
 * - Notifies all employees in the department (filtered by Site)
 */
export async function onWorkOrderCreated(workOrder: WorkOrderData) {
    try {
        await notifyNewWorkOrder({
            workOrderId: workOrder.id,
            workOrderNumber: workOrder.workOrderNumber,
            title: workOrder.title,
            type: workOrder.type,
            priority: workOrder.priority,
            departmentId: workOrder.departmentId || undefined,
            siteId: workOrder.siteId || undefined
        });
        console.log(`[Notification] New WO notification triggered for Dept: ${workOrder.departmentId}, Site: ${workOrder.siteId}`);
    } catch (error) {
        console.error('[Notification] Error sending new WO notification:', error);
    }
}

/**
 * Trigger notification when a Work Order is assigned to an employee
 * - Notifies the assigned employee and relevant Admins
 */
export async function onWorkOrderAssigned(
    workOrder: WorkOrderData,
    assigneeName?: string,
    triggeredByUserId?: string
) {
    try {
        await notifyWorkOrderAssigned({
            workOrderId: workOrder.id,
            workOrderNumber: workOrder.workOrderNumber,
            title: workOrder.title,
            type: workOrder.type,
            priority: workOrder.priority,
            assignedToId: workOrder.assignedToId || undefined,
            departmentId: workOrder.departmentId || undefined,
            siteId: workOrder.siteId || undefined,
            assigneeName,
            triggeredByUserId
        });
        console.log(`[Notification] Assignment notification processed for WO: ${workOrder.workOrderNumber}`);
    } catch (error) {
        console.error('[Notification] Error sending assignment notification:', error);
    }
}

/**
 * Trigger notification when Work Order status changes
 * - Notifies the assigned employee and relevant Admins
 * - Also notifies canvasing sales if WO is from canvasing
 */
export async function onWorkOrderStatusChanged(
    workOrder: WorkOrderData,
    oldStatus: string,
    newStatus: string,
    triggeredByUserId?: string
) {
    try {
        await notifyWorkOrderStatusChange({
            workOrderId: workOrder.id,
            workOrderNumber: workOrder.workOrderNumber,
            title: workOrder.title,
            type: workOrder.type,
            priority: workOrder.priority,
            assignedToId: workOrder.assignedToId || undefined,
            departmentId: workOrder.departmentId || undefined,
            siteId: workOrder.siteId || undefined,
            oldStatus,
            newStatus,
            triggeredByUserId
        });
        console.log(`[Notification] Status change notification processed: ${oldStatus} -> ${newStatus}`);

        // Notify canvasing sales if this WO is from canvasing
        await notifyCanvasingSalesOnWOStatusChange(workOrder.id, newStatus);
    } catch (error) {
        console.error('[Notification] Error sending status change notification:', error);
    }
}

/**
 * Notify canvasing sales when their WO status changes
 */
async function notifyCanvasingSalesOnWOStatusChange(workOrderId: string, newStatus: string) {
    try {
        // Check if this WO is linked to a canvasing
        const canvasing = await prisma.canvasing.findFirst({
            where: { workOrderId },
            select: {
                id: true,
                nama: true,
                salesId: true,
            }
        });

        if (!canvasing || !canvasing.salesId) return;

        // Notify sales based on status
        if (newStatus === 'IN_PROGRESS') {
            await createNotification({
                type: 'ANNOUNCEMENT',
                priority: 'NORMAL',
                title: '🔧 Instalasi Sedang Dikerjakan',
                message: `Teknisi sedang mengerjakan instalasi untuk ${canvasing.nama}`,
                link: `/marketing/canvasing/${canvasing.id}`,
                userId: canvasing.salesId,
                sourceType: 'CANVASING',
                sourceId: canvasing.id,
            });
            console.log(`[Notification] Canvasing IN_PROGRESS notif sent to sales: ${canvasing.salesId}`);
        } else if (['COMPLETED', 'VERIFIED', 'CLOSED'].includes(newStatus)) {
            await createNotification({
                type: 'ANNOUNCEMENT',
                priority: 'NORMAL',
                title: '✅ Instalasi Selesai',
                message: `Instalasi untuk ${canvasing.nama} selesai. Anda bisa claim poin sekarang!`,
                link: `/marketing/canvasing/${canvasing.id}`,
                userId: canvasing.salesId,
                sourceType: 'CANVASING',
                sourceId: canvasing.id,
            });
            console.log(`[Notification] Canvasing COMPLETED notif sent to sales: ${canvasing.salesId}`);
        }
    } catch (error) {
        console.error('[Notification] Error notifying canvasing sales:', error);
    }
}

/**
 * Trigger notification when Work Order is updated with a comment
 * - Notifies the assigned employee and relevant Admins
 */
export async function onWorkOrderUpdated(
    workOrder: WorkOrderData,
    updateMessage: string,
    updatedByName?: string,
    triggeredByUserId?: string
) {
    try {
        await notifyWorkOrderUpdate({
            workOrderId: workOrder.id,
            workOrderNumber: workOrder.workOrderNumber,
            title: workOrder.title,
            type: workOrder.type,
            priority: workOrder.priority,
            assignedToId: workOrder.assignedToId || undefined,
            departmentId: workOrder.departmentId || undefined,
            siteId: workOrder.siteId || undefined,
            updateMessage,
            updatedByName,
            triggeredByUserId
        });
        console.log(`[Notification] Update notification processed for WO: ${workOrder.workOrderNumber}`);
    } catch (error) {
        console.error('[Notification] Error sending update notification:', error);
    }
}

/**
 * Send manual reminder for a Work Order
 * - Notifies all technicians in the department if unassigned
 * - OR notifies the assigned technician if assigned
 */
export async function sendWorkOrderReminder(
    workOrder: WorkOrderData,
    customMessage?: string
): Promise<number> {
    try {
        const message = customMessage || `🔔 Masih Menunggu! ${workOrder.workOrderNumber} - ${workOrder.title}`;
        const title = "⚠️ Work Order Reminder";

        if (workOrder.assignedToId) {
            // Notify assigned user
            return await sendPushToUsers(
                [workOrder.assignedToId],
                title,
                message,
                { workOrderId: workOrder.id, type: 'WORK_ORDER', screen: 'WorkOrderDetail' }
            );
        } else if (workOrder.departmentId) {
            // Notify department (technicians)
            return await sendPushToDepartment(
                workOrder.departmentId,
                title,
                message,
                { workOrderId: workOrder.id, type: 'WORK_ORDER', screen: 'WorkOrderList' }
            );
        }

        return 0;
    } catch (error) {
        console.error('[Notification] Error sending reminder:', error);
        return 0;
    }
}
