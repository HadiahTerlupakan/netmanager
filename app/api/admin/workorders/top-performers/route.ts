import { prisma } from '@/modules/database';
import { WorkOrderRepository } from '@/modules/work-order';
import { isSuperAdmin } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api';
import { toStartOfDay, toEndOfDay } from '@/lib/utils/server-datetime'


const workOrderRepo = new WorkOrderRepository(prisma);

// GET /api/admin/workorders/top-performers
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user;

    if (!await hasPermission('work_order_dashboard:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat top performers');
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
        select: { id: true, role: true, departmentId: true }
    });

    if (!dbUser) return ApiErrors.unauthorized();

    // Enforce Department Restriction
    let departmentIdFilter: string | undefined = undefined;
    const permissions = ctx.permissions || [];
    const hasDepartmentRestriction = permissions.includes('workorders:department_only');
    const isSuper = isSuperAdmin(user);

    if (hasDepartmentRestriction && !isSuper) {
        if (!dbUser.departmentId) {
                return apiSuccess({
                performers: [],
                topAssists: [],
                message: "Restricted access: No department assigned."
            });
        }
        departmentIdFilter = dbUser.departmentId;
    }

    const [topPerformers, topAssists] = await Promise.all([
        workOrderRepo.getTopPerformers(5, dateFrom, dateTo, departmentIdFilter),
        workOrderRepo.getTopAssists(5, dateFrom, dateTo, departmentIdFilter)
    ]);

    return apiSuccess({
        performers: topPerformers,
        topAssists: topAssists,
    });
})
