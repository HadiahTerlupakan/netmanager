import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors } from '@/lib/api-response';

const workOrderRepo = new WorkOrderRepository(prisma);

// GET /api/admin/workorders/analytics
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        // Permission check
        if (!await hasPermission('work_order_dashboard:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat analitik work order');
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
        const isSuperAdmin = user.role === 'SUPER_ADMIN';

        if (hasDepartmentRestriction && !isSuperAdmin) {
            if (!user.departmentId) {
                 return apiSuccess({
                    issues: [],
                    sites: [],
                    disconnections: [],
                    message: "Restricted access: No department assigned."
                });
            }
            departmentIdFilter = user.departmentId;
        }

        // NEW: Enforce Site Restriction Logic
        let siteIdFilter: string | undefined = undefined;
        const hasSiteRestriction = user.permissions?.includes('workorders:site_only');
        
        if (hasSiteRestriction && !isSuperAdmin) {
            if (!user.siteId) {
                 return apiSuccess({
                    issues: [],
                    sites: [],
                    disconnections: [],
                    message: "Restricted access: No site assigned."
                });
            }
            siteIdFilter = user.siteId;
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
    } catch (error) {
        console.error('Error fetching analytics:', error);
        return ApiErrors.internalError('Gagal mengambil analitik');
    }
}
