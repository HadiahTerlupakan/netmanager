import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkOrderService, WorkOrderRepository } from '@/modules/work-order';
import { requireAuth } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/rbac';
import { workOrderCacheService } from '@/modules/work-order/services/WorkOrderCacheService';
import { onWorkOrderStatusChanged } from '@/modules/work-order/services/WorkOrderNotifications';
import { sendPushToUsers } from '@/modules/notification/services/ExpoPushService';
import { createNotification } from '@/modules/notification';
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response';

interface ExtendedUser {
  id: string
  role?: string
  permissions?: string[]
  siteId?: string
  departmentId?: string
  employee?: unknown
}

// Note: PATCH and DELETE handlers still use workOrderRepo for complex status transitions
// GET handler uses WorkOrderService
const workOrderRepo = new WorkOrderRepository(prisma);

/**
 * @swagger
 * /api/admin/workorders/{id}:
 *   get:
 *     summary: Get work order detail
 *     description: Retrieve detailed information about a specific work order
 *     tags: [Work Orders]
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth(request);
        if (session instanceof NextResponse) {
            return session;
        }
        const user = session.user as ExtendedUser;
        const workOrderService = getWorkOrderService();

        // Permission check
        if (!await hasPermission('list:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat work order');
        }

        const { id } = await params;
        const result = await workOrderService.getWorkOrderById(id, user);

        if (!result.success) {
            if (result.code === 'NOT_FOUND') {
                return ApiErrors.notFound('Work Order');
            }
            return apiError(result.error || 'Gagal mengambil work order', ErrorCodes.INTERNAL_ERROR, { status: 500 });
        }

        const workOrder = result.data!;

        // Access Control (Site & Department) - stays in route as context-specific
        const isSuperAdmin = user.role === 'SUPER_ADMIN';

        if (user.permissions?.includes('workorders:site_only') && !isSuperAdmin) {
            if (workOrder.siteId !== user.siteId) {
                return ApiErrors.forbidden('Anda hanya bisa mengakses work order di Site Anda');
            }
        }

        if (user.permissions?.includes('workorders:department_only') && !isSuperAdmin) {
            if (workOrder.departmentId !== user.departmentId) {
                return ApiErrors.forbidden('Anda hanya bisa mengakses work order di Departemen Anda');
            }
        }

        return apiSuccess(workOrder);
    } catch (error) {
        console.error('Error fetching work order:', error);
        return ApiErrors.internalError('Gagal mengambil work order');
    }
}

/**
 * @swagger
 * /api/admin/workorders/{id}:
 *   patch:
 *     summary: Update work order
 *     description: Update work order information including status and other fields.
 *     tags: [Work Orders]
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth(request);
        if (session instanceof NextResponse) {
            return session;
        }
        const user = session.user as ExtendedUser;
        const workOrderService = getWorkOrderService();

        const { id } = await params;
        const body = await request.json();

        // Determine Permission based on action
        let requiredPermission = 'list:update';

        // 1. Verification/Rejection Logic
        if (body.status === 'VERIFIED' || body.rejectionReason) {
            requiredPermission = 'list:verify';
        }

        // Permission check
        if (!await hasPermission(requiredPermission)) {
            return ApiErrors.forbidden('Anda tidak memiliki permission untuk tindakan ini');
        }

        // NEW: Pre-fetch for Access Control
        const existingWO = await workOrderRepo.findById(id);
        if (!existingWO) {
            return ApiErrors.notFound('Work Order');
        }

        const isSuperAdmin = user.role === 'SUPER_ADMIN';

        // 1. Site Check
        if (user.permissions?.includes('workorders:site_only') && !isSuperAdmin) {
            if (existingWO.siteId !== user.siteId) {
                return ApiErrors.forbidden('Anda hanya bisa mengupdate work order di Site Anda');
            }
        }

        // 2. Department Check
        if (user.permissions?.includes('workorders:department_only') && !isSuperAdmin) {
             if (existingWO.departmentId !== user.departmentId) {
                return ApiErrors.forbidden('Anda hanya bisa mengupdate work order di Departemen Anda');
            }
        }

        // Handle rejection reason or explicitly provided reason
        if (body.rejectionReason) {
            await workOrderRepo.addUpdate({
                workOrderId: id,
                updateType: 'NOTE',
                message: `[REJECTED] ${body.rejectionReason}`,
                createdById: user.id,
            });
            delete body.rejectionReason;
        }

        // Handle status change separately if provided
        if (body.status) {
            const oldStatus = existingWO.status;
            const statusResult = await workOrderService.updateStatus(id, body.status, user);

            if (!statusResult.success) {
                return apiError(statusResult.error || 'Gagal update status', ErrorCodes.INTERNAL_ERROR, { status: 500 });
            }

            // Re-fetch to get assigned user
            const updatedWO = await prisma.workOrders.findUnique({
                where: { id },
                include: { assignedTo: true }
            });

            // Notification Logic for Status Change
            try {
                // Determine notification message based on status
                let title = '';
                let message = '';
                let emoji = '';

                switch (body.status) {
                    case 'VERIFIED':
                        emoji = '✅';
                        title = `${emoji} Work Order Diverifikasi`;
                        message = `${updatedWO?.workOrderNumber}: Pekerjaan Anda telah diverifikasi!`;
                        break;
                    case 'REJECTED':
                        emoji = '❌';
                        title = `${emoji} Work Order Ditolak`;
                        message = `${updatedWO?.workOrderNumber}: Pekerjaan perlu diperbaiki. Lihat catatan.`;
                        break;
                    case 'CANCELLED':
                        emoji = '🚫';
                        title = `${emoji} Work Order Dibatalkan`;
                        message = `${updatedWO?.workOrderNumber}: ${body.cancelReason || 'Dibatalkan oleh Admin'}`;
                        break;
                    case 'CLOSED':
                        emoji = '🏁';
                        title = `${emoji} Work Order Selesai`;
                        message = `${updatedWO?.workOrderNumber}: Sudah ditutup.`;
                        break;
                    default:
                        emoji = '🔄';
                        title = `${emoji} Status WO Berubah`;
                        message = `${updatedWO?.workOrderNumber}: ${oldStatus} → ${body.status}`;
                }

                // 1. Notify assigned technician
                if (updatedWO?.assignedToId) {
                    await createNotification({
                        type: 'WORK_ORDER',
                        priority: 'NORMAL',
                        title: title,
                        message: message,
                        link: `/admin/workorders/${id}`,
                        userId: updatedWO.assignedToId,
                        siteId: updatedWO.siteId ?? undefined,
                        sourceType: 'WORK_ORDER',
                        sourceId: id,
                    });

                    // Push notification to mobile
                    await sendPushToUsers(
                        [updatedWO.assignedToId],
                        title,
                        message,
                        { workOrderId: id, type: 'WORK_ORDER', screen: 'WorkOrderDetail' }
                    );
                }

                // 2. Use the standard status change notification flow for other stakeholders
                await onWorkOrderStatusChanged({
                    id: updatedWO?.id || id,
                    workOrderNumber: updatedWO?.workOrderNumber || existingWO.workOrderNumber,
                    title: updatedWO?.title || existingWO.title,
                    type: updatedWO?.type || existingWO.type,
                    priority: updatedWO?.priority || existingWO.priority,
                    departmentId: updatedWO?.departmentId ?? null,
                    siteId: updatedWO?.siteId ?? null,
                    assignedToId: updatedWO?.assignedToId ?? null,
                }, oldStatus, body.status, user.id);

                console.log(`[Notification] Status change ${oldStatus} → ${body.status} for WO ${updatedWO?.workOrderNumber}`);
            } catch (notifyError) {
                console.error('Failed to send status update notification', notifyError);
            }

            delete body.status;
        }

        // Update other fields if any
        if (Object.keys(body).length > 0) {
            const updateResult = await workOrderService.updateWorkOrder(id, body, user);
            if (!updateResult.success) {
                return apiError(updateResult.error || 'Gagal memperbarui work order', ErrorCodes.INTERNAL_ERROR, { status: 500 });
            }
        }

        const workOrderResult = await workOrderService.getWorkOrderById(id, user);
        return apiSuccess(workOrderResult.data, { message: 'Work order berhasil diperbarui' });
    } catch (error) {
        console.error('Error updating work order:', error);
        return ApiErrors.internalError('Gagal memperbarui work order');
    }
}

/**
 * @swagger
 * /api/admin/workorders/{id}:
 *   delete:
 *     summary: Delete/cancel work order
 *     description: Cancel a work order with optional reason
 *     tags: [Work Orders]
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth(request);
        if (session instanceof NextResponse) {
            return session;
        }
        const user = session.user as ExtendedUser;
        const workOrderService = getWorkOrderService();

        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const reason = searchParams.get('reason') || 'Cancelled by admin';
        const isPermanent = searchParams.get('permanent') === 'true';

        // Permission check
        // Permanent delete requires list:delete
        // Cancel requires list:cancel
        const requiredPermission = isPermanent ? 'list:delete' : 'list:cancel';

        if (!await hasPermission(requiredPermission)) {
            return ApiErrors.forbidden('Anda tidak memiliki permission untuk tindakan ini');
        }

        // NEW: Pre-fetch for Access Control
        const existingWO = await workOrderRepo.findById(id);
        if (!existingWO) {
             return ApiErrors.notFound('Work Order');
        }

        const isSuperAdmin = user.role === 'SUPER_ADMIN';

        // 1. Site Check
        if (user.permissions?.includes('workorders:site_only') && !isSuperAdmin) {
            if (existingWO.siteId !== user.siteId) {
                return ApiErrors.forbidden('Anda hanya bisa menghapus work order di Site Anda');
            }
        }

        // 2. Department Check
        if (user.permissions?.includes('workorders:department_only') && !isSuperAdmin) {
             if (existingWO.departmentId !== user.departmentId) {
                return ApiErrors.forbidden('Anda hanya bisa menghapus work order di Departemen Anda');
            }
        }

        if (isPermanent) {
            // Reset any Canvasing records linked to this WO back to PENDING
            await prisma.canvasing.updateMany({
                where: { workOrderId: id },
                data: {
                    status: 'PENDING',
                    workOrderId: null,
                    approvedBy: null,
                    approvedAt: null
                }
            });

            const deleteResult = await workOrderService.deleteWorkOrder(id, user);
            if (!deleteResult.success) {
                return apiError(deleteResult.error || 'Gagal menghapus work order', ErrorCodes.INTERNAL_ERROR, { status: 500 });
            }

            return apiSuccess(null, { message: 'Work order berhasil dihapus permanen' });
        }

        // For cancel, we use updateStatus
        const cancelResult = await workOrderService.updateStatus(id, 'CANCELLED', user, reason);
        if (!cancelResult.success) {
             return apiError(cancelResult.error || 'Gagal membatalkan work order', ErrorCodes.INTERNAL_ERROR, { status: 500 });
        }

        // Notify assigned technician about cancellation
        try {
            if (existingWO.assignedToId) {
                const title = '🚫 Work Order Dibatalkan';
                const message = `${existingWO.workOrderNumber}: ${reason}`;

                // In-app notification
                await createNotification({
                    type: 'WORK_ORDER',
                    priority: 'NORMAL',
                    title: title,
                    message: message,
                    link: `/admin/workorders/${id}`,
                    userId: existingWO.assignedToId,
                    siteId: existingWO.siteId ?? undefined,
                    sourceType: 'WORK_ORDER',
                    sourceId: id,
                });

                // Push notification to mobile
                await sendPushToUsers(
                    [existingWO.assignedToId],
                    title,
                    message,
                    { workOrderId: id, type: 'WORK_ORDER', screen: 'WorkOrderList' }
                );

                // Notify other stakeholders
                await onWorkOrderStatusChanged({
                    id: existingWO.id,
                    workOrderNumber: existingWO.workOrderNumber,
                    title: existingWO.title,
                    type: existingWO.type,
                    priority: existingWO.priority,
                    departmentId: existingWO.departmentId ?? null,
                    siteId: existingWO.siteId ?? null,
                    assignedToId: existingWO.assignedToId ?? null,
                }, existingWO.status, 'CANCELLED', user.id);

                console.log(`[Notification] Cancel notification sent for WO ${existingWO.workOrderNumber}`);
            }
        } catch (notifyError) {
            console.error('Failed to send cancel notification', notifyError);
        }

        // System Log for Cancellation
        try {
            const { logger } = await import('@/lib/logger')
            await logger.logActivity({
                action: 'DELETE',
                subject: 'Work Order',
                userId: user.id,
                details: { id, reason, type: 'CANCEL' }
            })
        } catch (e) {
            console.error('Logging failed', e)
        }

        // PHASE 4: Invalidate caches after cancellation
        await workOrderCacheService.invalidateAllCaches();

        return apiSuccess(null, { message: 'Work order berhasil dibatalkan' });
    } catch (error) {
        console.error('Error cancelling work order:', error);
        return ApiErrors.internalError('Gagal membatalkan work order');
    }
}
