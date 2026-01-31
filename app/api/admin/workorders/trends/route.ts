import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response';

const workOrderRepo = new WorkOrderRepository(prisma);

/**
 * GET /api/admin/workorders/trends
 * 
 * Trend analytics endpoint for Work Order Dashboard
 */
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('work_order_dashboard:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat tren work order');
        }

        const { searchParams } = new URL(request.url);
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');

        // Validate required parameters
        if (!startDateParam || !endDateParam) {
            return apiError('startDate dan endDate wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 });
        }

        const startDate = new Date(startDateParam);
        const endDate = new Date(endDateParam);

        // Validate dates
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return apiError('Format tanggal tidak valid', ErrorCodes.VALIDATION_ERROR, { status: 400 });
        }

        if (startDate > endDate) {
            return apiError('startDate harus sebelum endDate', ErrorCodes.VALIDATION_ERROR, { status: 400 });
        }

        // Build access restriction filters
        const { departmentId, siteId } = buildAccessFilters(user);

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
    } catch (error) {
        console.error('Error fetching WO trends:', error);
        return ApiErrors.internalError('Gagal mengambil tren work order');
    }
}

/**
 * Build access restriction filters based on user permissions
 */
function buildAccessFilters(user: { id: string; permissions?: string[]; role?: string; departmentId?: string | null; siteId?: string | null }): {
    departmentId?: string;
    siteId?: string;
} {
    const hasDepartmentRestriction = user.permissions?.includes('workorders:department_only');
    const hasSiteRestriction = user.permissions?.includes('workorders:site_only');
    const isSuperAdmin = user.role === 'SUPER_ADMIN';

    let departmentId: string | undefined;
    let siteId: string | undefined;

    // Department restriction
    if (hasDepartmentRestriction && !isSuperAdmin && user.departmentId) {
        departmentId = user.departmentId;
    }

    // Site restriction
    if (hasSiteRestriction && !isSuperAdmin && user.siteId) {
        siteId = user.siteId;
    }

    return { 
        ...(departmentId ? { departmentId } : {}), 
        ...(siteId ? { siteId } : {}) 
    };
}
