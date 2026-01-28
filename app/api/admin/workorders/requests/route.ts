import { NextRequest, NextResponse } from 'next/server';
import { getWorkOrderService } from '@/modules/work-order';
import { requireAuth } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response';

/**
 * GET /api/admin/workorders/requests
 * List all Work Order Requests (status = REQUESTED)
 */
export async function GET(request: NextRequest) {
    try {
        const user = await requireAuth(request);
        if (user instanceof NextResponse) {
            return user;
        }

        // Permission check
        if (!await hasPermission('workorders:requests:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat permintaan work order');
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || undefined;
        const departmentId = searchParams.get('departmentId') || undefined;
        const siteId = searchParams.get('siteId') || undefined;

        const isSuperAdmin = user.role === 'SUPER_ADMIN';

        // Build filters
        const filters: { departmentId?: string; siteId?: string; search?: string } = { search };
        
        if (!isSuperAdmin) {
            if (user.permissions?.includes('workorders:site_only') && user.siteId) {
                filters.siteId = user.siteId;
            } else if (siteId) {
                filters.siteId = siteId;
            }
            
            if (user.permissions?.includes('workorders:department_only') && user.departmentId) {
                filters.departmentId = user.departmentId;
            } else if (departmentId) {
                filters.departmentId = departmentId;
            }
        } else {
            if (siteId) filters.siteId = siteId;
            if (departmentId) filters.departmentId = departmentId;
        }

        const workOrderService = getWorkOrderService();
        const result = await workOrderService.getWorkOrderRequests(filters, page, limit);

        if (!result.success) {
            return apiError(result.error || 'Gagal mengambil permintaan work order', ErrorCodes.INTERNAL_ERROR, { status: 500 });
        }

        return apiSuccess({
            data: result.data?.workOrders || [],
            pagination: {
                page: result.data?.page || page,
                totalPages: result.data?.totalPages || 1,
                total: result.data?.total || 0,
            },
            pendingCount: result.data?.total || 0,
        });
    } catch (error) {
        console.error('Error fetching work order requests:', error);
        return ApiErrors.internalError('Gagal mengambil permintaan work order');
    }
}
