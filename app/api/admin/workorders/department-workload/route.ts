import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';

const workOrderRepo = new WorkOrderRepository(prisma);

// GET /api/admin/workorders/department-workload - Get department workload statistics
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!await hasPermission('work_order_dashboard:read')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        let departmentIdFilter: string | undefined = undefined;

        // NEW: Enforce Department Restriction Logic
        const hasDepartmentRestriction = user.permissions?.includes('workorders:department_only');
        const isSuperAdmin = user.role === 'SUPER_ADMIN';

        if (hasDepartmentRestriction && !isSuperAdmin) {
            if (!user.departmentId) {
                return NextResponse.json({
                    success: true,
                    data: [],
                    message: "Restricted access: No department assigned."
                });
            }
            departmentIdFilter = user.departmentId;
        }

        const workload = await workOrderRepo.getDepartmentWorkload(departmentIdFilter);

        return NextResponse.json({
            success: true,
            data: workload,
        });
    } catch (error) {
        console.error('Error fetching department workload:', error);
        return NextResponse.json({ error: 'Failed to fetch department workload' }, { status: 500 });
    }
}
