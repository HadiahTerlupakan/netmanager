import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { isSuperAdmin } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api';
import { toStartOfDay, toEndOfDay } from '@/lib/utils/datetime'


const workOrderRepo = new WorkOrderRepository(prisma);

// GET /api/admin/workorders/analytics
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user;

    if (!await hasPermission('work_order_dashboard:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat analitik work order');
    }

    const { searchParams } = req.nextUrl;
    const period = searchParams.get('period') || 'all_time';

    let dateFrom: Date | undefined;
    let dateTo: Date | undefined;
    const now = new Date();

    if (period === 'daily') {
        dateFrom = new Date(now.setTime(toStartOfDay(now).getTime()));
        dateTo = new Date(now.setTime(toEndOfDay(now).getTime()));
    } else if (period === 'weekly') {
        const firstDay = now.getDate() - now.getDay(); // Sunday
        dateFrom = new Date(now.setDate(firstDay));
        dateFrom.setTime(toStartOfDay(dateFrom).getTime());
        dateTo = new Date();
    } else if (period === 'monthly') {
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        dateTo = new Date();
    } else if (period === 'yearly') {
        dateFrom = new Date(now.getFullYear(), 0, 1);
        dateTo = new Date();
    }

    // Fetch user details for restrictions
    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, role: true, departmentId: true, siteId: true }
    });

    if (!dbUser) return ApiErrors.unauthorized();

    // Enforce Restrictions
    let departmentIdFilter: string | undefined = undefined;
    const permissions = ctx.permissions || [];
    const hasDepartmentRestriction = permissions.includes('workorders:department_only');
    const isSuper = isSuperAdmin(user);

    if (hasDepartmentRestriction && !isSuper) {
        if (!dbUser.departmentId) {
                return apiSuccess({
                issues: [],
                sites: [],
                disconnections: [],
                message: "Restricted access: No department assigned."
            });
        }
        departmentIdFilter = dbUser.departmentId;
    }

    let siteIdFilter: string | undefined = undefined;
    const hasSiteRestriction = permissions.includes('workorders:site_only');

    if (hasSiteRestriction && !isSuper) {
        if (!dbUser.siteId) {
                return apiSuccess({
                issues: [],
                sites: [],
                disconnections: [],
                message: "Restricted access: No site assigned."
            });
        }
        siteIdFilter = dbUser.siteId;
    }

    const [issueStats, siteStats, disconnectionStats] = await Promise.all([
        workOrderRepo.getIssueStatistics(5, dateFrom, dateTo, departmentIdFilter, siteIdFilter),
        workOrderRepo.getSiteStatistics(5, dateFrom, dateTo, departmentIdFilter, siteIdFilter),
        workOrderRepo.getDisconnectionStatistics(dateFrom, dateTo, departmentIdFilter, siteIdFilter)
    ]);

    return apiSuccess({
        issues: issueStats,
        sites: siteStats,
        disconnections: disconnectionStats
    });
})
