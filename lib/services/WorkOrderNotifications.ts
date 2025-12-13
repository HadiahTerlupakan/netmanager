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
} from './NotificationService';

interface WorkOrderData {
    id: string;
    workOrderNumber: string;
    title: string;
    type: string;
    priority: string;
    departmentId?: string | null;
    assignedToId?: string | null;
}

/**
 * Trigger notification when a new Work Order is created
 * - Notifies all employees in the department
 */
export async function onWorkOrderCreated(workOrder: WorkOrderData) {
    try {
        if (workOrder.departmentId) {
            await notifyNewWorkOrder({
                workOrderId: workOrder.id,
                workOrderNumber: workOrder.workOrderNumber,
                title: workOrder.title,
                type: workOrder.type,
                priority: workOrder.priority,
                departmentId: workOrder.departmentId,
            });
            console.log(`[Notification] New WO notification sent to department: ${workOrder.departmentId}`);
        }
    } catch (error) {
        console.error('[Notification] Error sending new WO notification:', error);
    }
}

/**
 * Trigger notification when a Work Order is assigned to an employee
 * - Notifies the assigned employee
 */
export async function onWorkOrderAssigned(
    workOrder: WorkOrderData,
    assigneeName?: string
) {
    try {
        if (workOrder.assignedToId) {
            await notifyWorkOrderAssigned({
                workOrderId: workOrder.id,
                workOrderNumber: workOrder.workOrderNumber,
                title: workOrder.title,
                type: workOrder.type,
                priority: workOrder.priority,
                assignedToId: workOrder.assignedToId,
                assigneeName,
            });
            console.log(`[Notification] Assignment notification sent to employee: ${workOrder.assignedToId}`);
        }
    } catch (error) {
        console.error('[Notification] Error sending assignment notification:', error);
    }
}

/**
 * Trigger notification when Work Order status changes
 * - Notifies the assigned employee
 */
export async function onWorkOrderStatusChanged(
    workOrder: WorkOrderData,
    oldStatus: string,
    newStatus: string
) {
    try {
        if (workOrder.assignedToId) {
            await notifyWorkOrderStatusChange({
                workOrderId: workOrder.id,
                workOrderNumber: workOrder.workOrderNumber,
                title: workOrder.title,
                type: workOrder.type,
                priority: workOrder.priority,
                assignedToId: workOrder.assignedToId,
                oldStatus,
                newStatus,
            });
            console.log(`[Notification] Status change notification sent: ${oldStatus} -> ${newStatus}`);
        }
    } catch (error) {
        console.error('[Notification] Error sending status change notification:', error);
    }
}

/**
 * Trigger notification when Work Order is updated with a comment
 * - Notifies the assigned employee
 */
export async function onWorkOrderUpdated(
    workOrder: WorkOrderData,
    updateMessage: string,
    updatedByName?: string
) {
    try {
        if (workOrder.assignedToId) {
            await notifyWorkOrderUpdate({
                workOrderId: workOrder.id,
                workOrderNumber: workOrder.workOrderNumber,
                title: workOrder.title,
                type: workOrder.type,
                priority: workOrder.priority,
                assignedToId: workOrder.assignedToId,
                updateMessage,
                updatedByName,
            });
            console.log(`[Notification] Update notification sent for WO: ${workOrder.workOrderNumber}`);
        }
    } catch (error) {
        console.error('[Notification] Error sending update notification:', error);
    }
}
