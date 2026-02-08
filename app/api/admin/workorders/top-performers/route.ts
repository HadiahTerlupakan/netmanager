import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { verifyAuth, isSuperAdmin } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors } from '@/lib/api-response';

const workOrderRepo = new WorkOrderRepository(prisma);

// GET /api/admin/workorders/top-performers
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('work_order_dashboard:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat top performers');
        }

        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period') || 'all_time';

        let dateFrom: Date | undefined;
        let dateTo: Date | undefined;
        const now = new Date();

        if (period === 'daily') {
            dateFrom = new Date(now.setHours(0, 0, 0, 0));
            dateTo = new Date(now.setHours(23, 59, 59, 999));
        } else if (period === 'weekly') {
            const firstDay = now.getDate() - now.getDay(); // Sunday
            dateFrom = new Date(now.setDate(firstDay));
            dateFrom.setHours(0, 0, 0, 0);
            dateTo = new Date();
        } else if (period === 'monthly') {
            dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
            dateTo = new Date();
        } else if (period === 'yearly') {
            dateFrom = new Date(now.getFullYear(), 0, 1);
            dateTo = new Date();
        }

        // NEW: Enforce Department Restriction Logic
        let departmentIdFilter: string | undefined = undefined;
        const hasDepartmentRestriction = user.permissions?.includes('workorders:department_only');
        const isSuper = isSuperAdmin(user);

        if (hasDepartmentRestriction && !isSuper) {
            if (!user.departmentId) {
                 return apiSuccess({
                    data: [],
                    topAssists: [],
                    message: "Restricted access: No department assigned."
                });
            }
            departmentIdFilter = user.departmentId;
        }

        const [topPerformers, topAssists] = await Promise.all([
            workOrderRepo.getTopPerformers(5, dateFrom, dateTo, departmentIdFilter),
            workOrderRepo.getTopAssists(5, dateFrom, dateTo, departmentIdFilter)
        ]);

        return apiSuccess({
            performers: topPerformers,
            topAssists: topAssists,
        });
    } catch (error) {
        console.error('Error fetching top performers:', error);
        return ApiErrors.internalError('Gagal mengambil top performers');
    }
}
