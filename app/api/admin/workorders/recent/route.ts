import { getWorkOrderService } from '@/modules/work-order';
import { isSuperAdmin } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api';
import { prisma } from '@/modules/database';

// GET /api/admin/workorders/recent
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user;

    if (!await hasPermission('list:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat work order');
    }

    const { searchParams } = req.nextUrl;
    const limit = parseInt(searchParams.get('limit') || '5');

    const filters: { departmentId?: string } = {};

    // Fetch user details for restrictions
    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, role: true, departmentId: true }
    });

    if (!dbUser) return ApiErrors.unauthorized();

    // Access Control
    const permissions = ctx.permissions || [];
    const hasDepartmentRestriction = permissions.includes('workorders:department_only');
    const isSuper = isSuperAdmin(user);

    if (hasDepartmentRestriction && !isSuper) {
        if (!dbUser.departmentId) {
            return apiSuccess([], { message: "Restricted access: No department assigned." });
        }
        filters.departmentId = dbUser.departmentId;
    }

    const workOrderService = getWorkOrderService();
    const result = await workOrderService.getRecentWorkOrders(limit, filters);

    if (!result.success) {
        return apiError(result.error || 'Gagal mengambil work order terbaru', ErrorCodes.INTERNAL_ERROR, { status: 500 });
    }

    return apiSuccess(result.data);
})
