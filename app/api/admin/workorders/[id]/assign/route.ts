import { prisma } from '@/modules/database';
import { getWorkOrderService, type UserContext } from '@/modules/work-order';
import { isSuperAdmin } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api';

// POST /api/admin/workorders/[id]/assign - Assign work order
export const POST = createHandler({ auth: true }, async (req, ctx) => {
    const userBase = ctx.session!.user;
    const { id } = ctx.params;

    if (!await hasPermission('list:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk assign work order');
    }

    // Fetch extended user context
    const dbUser = await prisma.user.findUnique({
        where: { id: userBase.id },
        select: { id: true, departmentId: true, siteId: true }
    });
    if (!dbUser) return ApiErrors.unauthorized();

    const userContext: UserContext = {
        id: userBase.id,
        role: userBase.role,
        permissions: ctx.permissions,
        siteId: dbUser.siteId || undefined,
        departmentId: dbUser.departmentId || undefined,
    }

    const workOrderService = getWorkOrderService();

    // Get WO for access control check
    const getResult = await workOrderService.getWorkOrderById(id, userContext);
    if (!getResult.success) {
        return ApiErrors.notFound('Work Order');
    }
    const existingWO = getResult.data!;

    // Access Control
    const isSuper = isSuperAdmin(userBase);
    if (userContext.permissions?.includes('workorders:site_only') && !isSuper) {
        if (existingWO.siteId !== userContext.siteId) {
            return ApiErrors.forbidden('Anda hanya dapat mengakses work order di site Anda');
        }
    }
    if (userContext.permissions?.includes('workorders:department_only') && !isSuper) {
        if (existingWO.departmentId !== userContext.departmentId) {
            return ApiErrors.forbidden('Anda hanya dapat mengakses work order di departemen Anda');
        }
    }

    const body = await req.json();

    if (!body.employeeId) {
        return apiError('Employee ID wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 });
    }

    // Use service for assignment
    const result = await workOrderService.assignWorkOrder(id, body.employeeId, userContext, body.role);

    if (!result.success) {
        return apiError(result.error || 'Gagal assign work order', ErrorCodes.INTERNAL_ERROR, { status: 500 });
    }

    return apiSuccess(result.data, { message: 'Work order berhasil di-assign' });
})
