import { getWorkOrderService } from '@/modules/work-order';
import { hasPermission } from '@/lib/rbac';
import { isSuperAdmin } from '@/lib/auth';
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api';
import { prisma } from '@/modules/database';

/**
 * GET /api/admin/workorders/requests
 * List all Work Order Requests (status = REQUESTED)
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user;

    if (!await hasPermission('workorders:requests:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat permintaan work order');
    }

    const { searchParams } = req.nextUrl;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || undefined;
    const departmentId = searchParams.get('departmentId') || undefined;
    const siteId = searchParams.get('siteId') || undefined;

    // Fetch user details for restrictions
    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, role: true, departmentId: true, siteId: true }
    });

    if (!dbUser) return ApiErrors.unauthorized();

    const isSuper = isSuperAdmin(user);
    const permissions = ctx.permissions || [];

    // Build filters
    const filters: { departmentId?: string; siteId?: string; search?: string } = {
        ...(search ? { search } : {})
    };

    if (!isSuper) {
        if (permissions.includes('workorders:site_only') && dbUser.siteId) {
            filters.siteId = dbUser.siteId;
        } else if (siteId) {
            filters.siteId = siteId;
        }

        if (permissions.includes('workorders:department_only') && dbUser.departmentId) {
            filters.departmentId = dbUser.departmentId;
        } else if (departmentId) {
            filters.departmentId = departmentId;
        }
    } else {
        if (siteId) filters.siteId = siteId;
        if (departmentId) filters.departmentId = departmentId;
    }

    const workOrderService = getWorkOrderService();
    const result = await workOrderService.getWorkOrderRequests(filters, page, limit);

    if (!result.success) {
        return apiError(result.error || 'Gagal mengambil permintaan work order', ErrorCodes.INTERNAL_ERROR, { status: 500 });
    }

    return apiSuccess({
        data: result.data?.workOrders || [],
        pagination: {
            page: result.data?.page || page,
            totalPages: result.data?.totalPages || 1,
            total: result.data?.total || 0,
        },
        pendingCount: result.data?.total || 0,
    });
})
