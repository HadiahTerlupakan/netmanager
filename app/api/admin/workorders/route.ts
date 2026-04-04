import { getWorkOrderService } from '@/modules/work-order';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api';

/**
 * GET /api/admin/workorders
 * Get all work orders
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user;

    // Permission check
    if (!await hasPermission('list:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat work order');
    }

    const { searchParams } = req.nextUrl;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const type = searchParams.get('type');
    const departmentId = searchParams.get('departmentId');
    const siteId = searchParams.get('siteId');
    const assignedToId = searchParams.get('assignedToId');
    const search = searchParams.get('search');
    const unassignedOnly = searchParams.get('unassignedOnly') === 'true';
    const woType = searchParams.get('woType'); // 'customer' | 'internal'

    // Build filters
    const filters: Record<string, string | string[] | boolean> = {};
    if (status) filters.status = status.includes(',') ? status.split(',') : status;
    if (priority) filters.priority = priority.includes(',') ? priority.split(',') : priority;
    if (type) filters.type = type.includes(',') ? type.split(',') : type;
    if (unassignedOnly) filters.unassignedOnly = true;
    if (departmentId) filters.departmentId = departmentId;
    if (siteId) filters.siteId = siteId;
    if (search) filters.search = search;
    if (assignedToId) filters.assignedToId = assignedToId;
    
    // Filter by WO Type (Customer vs Internal)
    if (woType === 'customer') {
        filters.isInternal = false;
    } else if (woType === 'internal') {
        filters.isInternal = true;
    }

    // Fetch extended user context
    const { prisma: db } = await import('@/modules/database');
    const dbUser = await db.user.findUnique({
        where: { id: user.id },
        select: { id: true, departmentId: true, siteId: true }
    });

    if (!dbUser) return ApiErrors.unauthorized('User tidak valid');

    // Use WorkOrderService with user context for permission-based filtering
    const workOrderService = getWorkOrderService();
    const result = await workOrderService.getWorkOrders({
        page,
        limit,
        filters,
        userId: user.id,
        userPermissions: ctx.permissions || [],
        ...(dbUser.departmentId ? { userDepartmentId: dbUser.departmentId } : {}),
        ...(dbUser.siteId ? { userSiteId: dbUser.siteId } : {}),
        ...(user.role ? { userRole: user.role } : {}),
    });

    if (!result.success) {
        return apiError(result.error || 'Gagal mengambil work order', ErrorCodes.INTERNAL_ERROR, { status: 500 });
    }

    return apiSuccess(result.data);
})

/**
 * POST /api/admin/workorders
 * Create new work order
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
    // Permission check
    if (!await hasPermission('list:create')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat work order');
    }

    const body = await req.json();

    // Use WorkOrderService for creation (handles validation, notifications, socket, logging, cache)
    const workOrderService = getWorkOrderService();
    const result = await workOrderService.createWorkOrder(body, ctx.session!.user);

    if (!result.success) {
        if (result.code === 'FORBIDDEN') {
            return apiError(result.error || 'Akses ditolak', ErrorCodes.FORBIDDEN, { status: 403 });
        }
        if (result.code === 'VALIDATION_ERROR') {
            return apiError(result.error || 'Data tidak valid', ErrorCodes.VALIDATION_ERROR, { status: 400 });
        }
        return apiError(result.error || 'Gagal membuat work order', ErrorCodes.INTERNAL_ERROR, { status: 500 });
    }

    return apiSuccess(result.data, { status: 201, message: 'Work order berhasil dibuat' });
})
