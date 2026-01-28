import { NextRequest } from 'next/server';
import { getWorkOrderService } from '@/modules/work-order';
import { verifyAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response';

// GET /api/admin/workorders/recent - Get recent work orders
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('list:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat work order');
        }

        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '5');

        const filters: any = {};
        
        // Access Control
        const hasDepartmentRestriction = user.permissions?.includes('workorders:department_only');
        const isSuperAdmin = user.role === 'SUPER_ADMIN';

        if (hasDepartmentRestriction && !isSuperAdmin) {
            if (!user.departmentId) {
                return apiSuccess([], { message: "Restricted access: No department assigned." });
            }
            filters.departmentId = user.departmentId;
        }

        const workOrderService = getWorkOrderService();
        const result = await workOrderService.getRecentWorkOrders(limit, filters);

        if (!result.success) {
            return apiError(result.error || 'Gagal mengambil work order terbaru', ErrorCodes.INTERNAL_ERROR, { status: 500 });
        }

        return apiSuccess(result.data);
    } catch (error) {
        console.error('Error fetching recent work orders:', error);
        return ApiErrors.internalError('Gagal mengambil work order terbaru');
    }
}
