import { prisma } from '@/modules/database';
import { getWorkOrderService, WorkOrderRepository } from '@/modules/work-order';
import { isSuperAdmin } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { workOrderCacheService } from '@/modules/work-order';
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api';
import { logActivitySafe } from '@/lib/logger';

interface ExtendedUser {
  id: string
  role?: string
  permissions?: string[]
  siteId?: string
  departmentId?: string
  email: string
  name?: string
}

const workOrderRepo = new WorkOrderRepository(prisma);

/**
 * GET /api/admin/workorders/{id}
 * Get work order detail
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
    const userBase = ctx.session!.user;
    const { id } = ctx.params;

    // Fetch extended user context for RBAC
    const dbUser = await prisma.user.findUnique({
        where: { id: userBase.id },
        select: { id: true, departmentId: true, siteId: true }
    });

    if (!dbUser) return ApiErrors.unauthorized();

    // Construct extended user object manually to match Expected type in Service if needed
    // But getWorkOrderById mainly needs user ID and RBAC checks
    const user: ExtendedUser = {
        ...userBase,
        permissions: ctx.permissions,
        siteId: dbUser.siteId || undefined,
        departmentId: dbUser.departmentId || undefined,
    }

    const workOrderService = getWorkOrderService();

    // Permission check
    if (!await hasPermission('list:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat work order');
    }

    const result = await workOrderService.getWorkOrderById(id, user);

    if (!result.success) {
        if (result.code === 'NOT_FOUND') {
            return ApiErrors.notFound('Work Order');
        }
        return apiError(result.error || 'Gagal mengambil work order', ErrorCodes.INTERNAL_ERROR, { status: 500 });
    }

    const workOrder = result.data!;

    // Access Control (Site & Department)
    const isSuper = isSuperAdmin(user);

    if (user.permissions?.includes('workorders:site_only') && !isSuper) {
        if (workOrder.siteId !== user.siteId) {
            return ApiErrors.forbidden('Anda hanya bisa mengakses work order di Site Anda');
        }
    }

    if (user.permissions?.includes('workorders:department_only') && !isSuper) {
        if (workOrder.departmentId !== user.departmentId) {
            return ApiErrors.forbidden('Anda hanya bisa mengakses work order di Departemen Anda');
        }
    }

    return apiSuccess(workOrder);
})

/**
 * PATCH /api/admin/workorders/{id}
 * Update work order
 */
export const PATCH = createHandler({ auth: true }, async (req, ctx) => {
    const userBase = ctx.session!.user;
    const { id } = ctx.params;
    const body = await req.json();

    // Fetch extended user context for RBAC
    const dbUser = await prisma.user.findUnique({
        where: { id: userBase.id },
        select: { id: true, departmentId: true, siteId: true }
    });

    if (!dbUser) return ApiErrors.unauthorized();

    const user: ExtendedUser = {
        ...userBase,
        permissions: ctx.permissions,
        siteId: dbUser.siteId || undefined,
        departmentId: dbUser.departmentId || undefined,
    }

    const workOrderService = getWorkOrderService();

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

    const isSuper = isSuperAdmin(user);

    // 1. Site Check
    if (user.permissions?.includes('workorders:site_only') && !isSuper) {
        if (existingWO.siteId !== user.siteId) {
            return ApiErrors.forbidden('Anda hanya bisa mengupdate work order di Site Anda');
        }
    }

    // 2. Department Check
    if (user.permissions?.includes('workorders:department_only') && !isSuper) {
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
        const statusResult = await workOrderService.updateStatus(id, body.status, user);

        if (!statusResult.success) {
            return apiError(statusResult.error || 'Gagal update status', ErrorCodes.INTERNAL_ERROR, { status: 500 });
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
})

/**
 * DELETE /api/admin/workorders/{id}
 * Delete/cancel work order
 */
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    const userBase = ctx.session!.user;
    const { id } = ctx.params;
    const { searchParams } = req.nextUrl;
    const reason = searchParams.get('reason') || 'Cancelled by admin';
    const isPermanent = searchParams.get('permanent') === 'true';

    // Fetch extended user context for RBAC
    const dbUser = await prisma.user.findUnique({
        where: { id: userBase.id },
        select: { id: true, departmentId: true, siteId: true }
    });

    if (!dbUser) return ApiErrors.unauthorized();

    const user: ExtendedUser = {
        ...userBase,
        permissions: ctx.permissions,
        siteId: dbUser.siteId || undefined,
        departmentId: dbUser.departmentId || undefined,
    }

    const workOrderService = getWorkOrderService();

    // Permission check
    const requiredPermission = isPermanent ? 'list:delete' : 'list:cancel';

    if (!await hasPermission(requiredPermission)) {
        return ApiErrors.forbidden('Anda tidak memiliki permission untuk tindakan ini');
    }

    // NEW: Pre-fetch for Access Control
    const existingWO = await workOrderRepo.findById(id);
    if (!existingWO) {
            return ApiErrors.notFound('Work Order');
    }

    const isSuper = isSuperAdmin(user);

    // 1. Site Check
    if (user.permissions?.includes('workorders:site_only') && !isSuper) {
        if (existingWO.siteId !== user.siteId) {
            return ApiErrors.forbidden('Anda hanya bisa menghapus work order di Site Anda');
        }
    }

    // 2. Department Check
    if (user.permissions?.includes('workorders:department_only') && !isSuper) {
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
            if (deleteResult.code === 'NOT_FOUND') {
                return ApiErrors.notFound('Work Order');
            }
            if (deleteResult.code === 'FORBIDDEN') {
                return ApiErrors.forbidden(deleteResult.error || 'Akses ditolak');
            }
            return apiError(deleteResult.error || 'Gagal menghapus work order', ErrorCodes.INTERNAL_ERROR, { status: 500 });
        }

        return apiSuccess(null, { message: 'Work order berhasil dihapus permanen' });
    }

    // For cancel, we use updateStatus
    const cancelResult = await workOrderService.updateStatus(id, 'CANCELLED', user, reason);
    if (!cancelResult.success) {
        if (cancelResult.code === 'NOT_FOUND') {
            return ApiErrors.notFound('Work Order');
        }
        if (cancelResult.code === 'FORBIDDEN') {
            return ApiErrors.forbidden(cancelResult.error || 'Akses ditolak');
        }
        return apiError(cancelResult.error || 'Gagal membatalkan work order', ErrorCodes.INTERNAL_ERROR, { status: 500 });
    }

    // System Log for Cancellation
    logActivitySafe({
        action: 'DELETE',
        subject: 'Work Order',
        userId: user.id,
        details: { id, reason, type: 'CANCEL' }
    })

    // PHASE 4: Invalidate caches after cancellation
    await workOrderCacheService.invalidateAllCaches();

    return apiSuccess(null, { message: 'Work order berhasil dibatalkan' });
})
