import { NextRequest } from 'next/server';
import { getWorkOrderService } from '@/modules/work-order';
import { verifyAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response';

const EMPTY_STATS = {
    total: 0, pending: 0, assigned: 0, inProgress: 0, onHold: 0,
    completed: 0, verified: 0, closed: 0, cancelled: 0, urgentOpen: 0,
    avgCompletionTimeHours: 0, totalCost: 0, avgRating: null, totalWithRating: 0
};

// GET /api/admin/workorders/stats - Get statistics
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('work_order_dashboard:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat statistik work order');
        }

        const { searchParams } = new URL(request.url);
        const departmentId = searchParams.get('departmentId');
        const assignedToId = searchParams.get('assignedToId');

        const filters: any = {};
        if (departmentId) filters.departmentId = departmentId;
        if (assignedToId) filters.assignedToId = assignedToId;

        // Access Control
        const hasDepartmentRestriction = user.permissions?.includes('workorders:department_only');
        const hasSiteRestriction = user.permissions?.includes('workorders:site_only');
        const isSuperAdmin = user.role === 'SUPER_ADMIN';

        if (hasDepartmentRestriction && !isSuperAdmin) {
            if (!user.departmentId) {
                return apiSuccess(EMPTY_STATS);
            }
            filters.departmentId = user.departmentId;
        }

        if (hasSiteRestriction && !isSuperAdmin) {
            if (!user.siteId) {
                return apiSuccess(EMPTY_STATS);
            }
            filters.siteId = user.siteId;
        }

        const workOrderService = getWorkOrderService();
        const result = await workOrderService.getStatistics(filters);

        if (!result.success) {
            return apiError(result.error || 'Gagal mengambil statistik', ErrorCodes.INTERNAL_ERROR, { status: 500 });
        }

        return apiSuccess(result.data);
    } catch (error) {
        console.error('Error fetching statistics:', error);
        return ApiErrors.internalError('Gagal mengambil statistik');
    }
}
