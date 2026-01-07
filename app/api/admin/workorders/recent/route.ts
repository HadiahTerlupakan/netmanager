import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';

const workOrderRepo = new WorkOrderRepository(prisma);

// GET /api/admin/workorders/recent - Get recent work orders
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!await hasPermission('list:read')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '5');

        const filters: any = {};
        
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
            filters.departmentId = user.departmentId;
        }

        const workOrders = await workOrderRepo.getRecentWorkOrders(limit, filters);

        return NextResponse.json({
            success: true,
            data: workOrders,
        });
    } catch (error) {
        console.error('Error fetching recent work orders:', error);
        return NextResponse.json({ error: 'Failed to fetch recent work orders' }, { status: 500 });
    }
}
