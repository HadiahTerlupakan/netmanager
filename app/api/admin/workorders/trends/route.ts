import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { isSuperAdmin } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api';

const workOrderRepo = new WorkOrderRepository(prisma);

/**
 * GET /api/admin/workorders/trends
 * Trend analytics endpoint
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user;

    if (!await hasPermission('work_order_dashboard:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat tren work order');
    }

    const { searchParams } = req.nextUrl;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!startDateParam || !endDateParam) {
        return apiError('startDate dan endDate wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 });
    }

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return apiError('Format tanggal tidak valid', ErrorCodes.VALIDATION_ERROR, { status: 400 });
    }

    if (startDate > endDate) {
        return apiError('startDate harus sebelum endDate', ErrorCodes.VALIDATION_ERROR, { status: 400 });
    }

    // Fetch user details for restrictions
    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, role: true, departmentId: true, siteId: true }
    });

    if (!dbUser) return ApiErrors.unauthorized();

    // Build Access Filters
    const permissions = ctx.permissions || [];
    const hasDepartmentRestriction = permissions.includes('workorders:department_only');
    const hasSiteRestriction = permissions.includes('workorders:site_only');
    const isSuper = isSuperAdmin(user);

    let departmentId: string | undefined;
    let siteId: string | undefined;

    if (hasDepartmentRestriction && !isSuper && dbUser.departmentId) {
        departmentId = dbUser.departmentId;
    }

    if (hasSiteRestriction && !isSuper && dbUser.siteId) {
        siteId = dbUser.siteId;
    }

    // Execute all trend queries in parallel
    const [volumeTrend, issueTrend, performanceTrend, typeTrend] = await Promise.all([
        workOrderRepo.getVolumeTrend(startDate, endDate, departmentId, siteId),
        workOrderRepo.getIssueTrend(startDate, endDate, departmentId, siteId),
        workOrderRepo.getPerformanceTrend(startDate, endDate, departmentId, siteId),
        workOrderRepo.getTypeTrend(startDate, endDate, departmentId, siteId),
    ]);

    return apiSuccess({
        volumeTrend,
        issueTrend,
        performanceTrend,
        typeTrend,
        dateRange: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
        }
    });
})
