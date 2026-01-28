import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors } from '@/lib/api-response';

const workOrderRepo = new WorkOrderRepository(prisma);

// GET /api/admin/workorders/department-workload - Get department workload statistics
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('work_order_dashboard:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat beban kerja departemen');
        }

        let departmentIdFilter: string | undefined = undefined;

        // NEW: Enforce Department Restriction Logic
        const hasDepartmentRestriction = user.permissions?.includes('workorders:department_only');
        const isSuperAdmin = user.role === 'SUPER_ADMIN';

        if (hasDepartmentRestriction && !isSuperAdmin) {
            if (!user.departmentId) {
                return apiSuccess([], { message: "Restricted access: No department assigned." });
            }
            departmentIdFilter = user.departmentId;
        }

        const workload = await workOrderRepo.getDepartmentWorkload(departmentIdFilter);

        return apiSuccess(workload);
    } catch (error) {
        console.error('Error fetching department workload:', error);
        return ApiErrors.internalError('Gagal mengambil beban kerja departemen');
    }
}
