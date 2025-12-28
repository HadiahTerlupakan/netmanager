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

        const workload = await workOrderRepo.getDepartmentWorkload();

        return NextResponse.json({
            success: true,
            data: workload,
        });
    } catch (error) {
        console.error('Error fetching department workload:', error);
        return NextResponse.json({ error: 'Failed to fetch department workload' }, { status: 500 });
    }
}
