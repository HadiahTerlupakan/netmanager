import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { isSuperAdmin } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api';
import { toStartOfDay } from '@/lib/utils/server-datetime'


const workOrderRepo = new WorkOrderRepository(prisma);

// GET /api/admin/workorders/response-stats
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user;

    if (!await hasPermission('work_order_dashboard:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat statistik response');
    }

    const { searchParams } = req.nextUrl;
    const period = searchParams.get('period') || 'last_30_days'; // default
    let departmentId = searchParams.get('departmentId') || undefined;

    let dateFrom: Date;
    const dateTo: Date = new Date(); // now

    // Date calculation logic
    if (period === 'daily') {
        const now = new Date();
        dateFrom = new Date(now.setTime(toStartOfDay(now).getTime()));
    } else if (period === 'weekly') {
        const now = new Date();
        const firstDay = now.getDate() - now.getDay(); 
        dateFrom = new Date(now.setDate(firstDay));
        dateFrom.setTime(toStartOfDay(dateFrom).getTime());
    } else if (period === 'monthly') {
        const now = new Date();
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'last_30_days') {
        const now = new Date();
        dateFrom = new Date(now.setDate(now.getDate() - 30));
    } else {
            // Default to last 30 days if unknown
        const now = new Date();
        dateFrom = new Date(now.setDate(now.getDate() - 30));
    }

    // Fetch user details for restrictions
    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, role: true, departmentId: true }
    });

    if (!dbUser) return ApiErrors.unauthorized();

    // Enforce Department Restriction
    const permissions = ctx.permissions || [];
    const hasDepartmentRestriction = permissions.includes('workorders:department_only');
    const isSuper = isSuperAdmin(user);

    if (hasDepartmentRestriction && !isSuper) {
        if (!dbUser.departmentId) {
            return apiSuccess([]); // No access to any department data
        }
        departmentId = dbUser.departmentId;
    }

    const stats = await workOrderRepo.getAdminResponseStats(dateFrom, dateTo, departmentId);

    return apiSuccess(stats);
})
