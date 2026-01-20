import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { onWorkOrderAssigned } from '@/modules/work-order/services/WorkOrderNotifications';
import { sendPushToUsers } from '@/modules/notification/services/ExpoPushService';
import { createNotification } from '@/modules/notification';

const workOrderRepo = new WorkOrderRepository(prisma);

// POST /api/admin/workorders/[id]/assign - Assign work order
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!await hasPermission('list:update')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;

        // NEW: Ownership Check
        const existingWO = await workOrderRepo.findById(id);
        if (!existingWO) {
            return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
        }

        const isSuperAdmin = user.role === 'SUPER_ADMIN';
        if (user.permissions?.includes('workorders:site_only') && !isSuperAdmin) {
            if (existingWO.siteId !== user.siteId) {
                return NextResponse.json({ error: 'Forbidden: Restricted to your Site' }, { status: 403 });
            }
        }
        if (user.permissions?.includes('workorders:department_only') && !isSuperAdmin) {
            if (existingWO.departmentId !== user.departmentId) {
                return NextResponse.json({ error: 'Forbidden: Restricted to your Department' }, { status: 403 });
            }
        }

        const body = await request.json();

        if (!body.employeeId) {
            return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
        }

        const workOrder = await workOrderRepo.assign(id, body.employeeId, body.role, user.id);

        // Get employee details for notification
        const employee = await prisma.user.findUnique({
            where: { id: body.employeeId },
            select: { id: true, name: true, pushToken: true, isActive: true }
        });

        await workOrderRepo.addUpdate({
            workOrderId: id,
            updateType: 'NOTE',
            message: `Work order assigned to ${employee?.name || body.employeeId}`,
            createdById: user.id,
        });

        // Send notification to assigned technician
        if (employee) {
            // 1. In-app notification
            await createNotification({
                type: 'WORK_ORDER',
                priority: (workOrder.priority === 'CRITICAL' ? 'URGENT' : workOrder.priority) as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT',
                title: '📋 Work Order Di-assign ke Anda',
                message: `${workOrder.workOrderNumber}: ${workOrder.title}`,
                link: `/admin/workorders/${workOrder.id}`,
                userId: employee.id,
                siteId: workOrder.siteId || undefined,
                sourceType: 'WORK_ORDER',
                sourceId: workOrder.id,
            });

            // 2. Push notification to mobile
            if (employee.pushToken && employee.isActive) {
                await sendPushToUsers(
                    [employee.id],
                    '📋 Work Order Baru',
                    `${workOrder.workOrderNumber}: ${workOrder.title}`,
                    { workOrderId: workOrder.id, type: 'WORK_ORDER', screen: 'WorkOrderDetail' }
                );
            }

            console.log(`[Notification] Assignment notification sent to ${employee.name} for WO ${workOrder.workOrderNumber}`);
        }

        // Also trigger the full assignment notification flow
        await onWorkOrderAssigned({
            id: workOrder.id,
            workOrderNumber: workOrder.workOrderNumber,
            title: workOrder.title,
            type: workOrder.type,
            priority: workOrder.priority,
            departmentId: workOrder.departmentId || undefined,
            siteId: workOrder.siteId || undefined,
            assignedToId: workOrder.assignedToId || undefined,
        }, employee?.name ?? undefined, user.id);

        // System Log
        try {
            const { logger } = await import('@/lib/logger');
            await logger.logActivity({
                action: 'UPDATE',
                subject: 'Work Order',
                userId: user.id,
                details: { id: workOrder.id, action: 'ASSIGN', assignedTo: employee?.name || body.employeeId }
            });
        } catch (e) {
            console.error('Logging failed', e);
        }

        return NextResponse.json({
            success: true,
            data: workOrder,
            message: 'Work order assigned successfully',
        });
    } catch (error) {
        console.error('Error assigning work order:', error);
        return NextResponse.json({ error: 'Failed to assign work order' }, { status: 500 });
    }
}
