import { getWorkOrderService } from '@/modules/work-order';
import { isSuperAdmin } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api';
import { prisma } from '@/lib/prisma';

const EMPTY_STATS = {
    total: 0, pending: 0, assigned: 0, inProgress: 0, onHold: 0,
    completed: 0, verified: 0, closed: 0, cancelled: 0, urgentOpen: 0,
    avgCompletionTimeHours: 0, totalCost: 0, avgRating: null as number | null, totalWithRating: 0
};

// GET /api/admin/workorders/stats - Get statistics
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user;

    if (!await hasPermission('work_order_dashboard:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat statistik work order');
    }

    const { searchParams } = req.nextUrl;
    const departmentId = searchParams.get('departmentId');
    const assignedToId = searchParams.get('assignedToId');

    const filters: Record<string, string> = {};
    if (departmentId) filters.departmentId = departmentId;
    if (assignedToId) filters.assignedToId = assignedToId;

    // Fetch extended user context for RBAC
    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, role: true, departmentId: true, siteId: true }
    });

    if (!dbUser) return ApiErrors.unauthorized();

    // Access Control
    const permissions = ctx.permissions || [];
    const hasDepartmentRestriction = permissions.includes('workorders:department_only');
    const hasSiteRestriction = permissions.includes('workorders:site_only');
    const isSuper = isSuperAdmin(user);

    if (hasDepartmentRestriction && !isSuper) {
        if (!dbUser.departmentId) {
            return apiSuccess(EMPTY_STATS);
        }
        filters.departmentId = dbUser.departmentId;
    }

    if (hasSiteRestriction && !isSuper) {
        if (!dbUser.siteId) {
            return apiSuccess(EMPTY_STATS);
        }
        filters.siteId = dbUser.siteId;
    }

    const workOrderService = getWorkOrderService();
    const result = await workOrderService.getStatistics(filters);

    if (!result.success) {
        return apiError(result.error || 'Gagal mengambil statistik', ErrorCodes.INTERNAL_ERROR, { status: 500 });
    }

    return apiSuccess(result.data);
})
