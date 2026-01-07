import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';

const workOrderRepo = new WorkOrderRepository(prisma);

// POST /api/admin/workorders/[id]/assign - Assign work order
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!await hasPermission('list:update')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;

        // NEW: Ownership Check
        const existingWO = await workOrderRepo.findById(id);
        if (!existingWO) {
            return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
        }

        const isSuperAdmin = user.role === 'SUPER_ADMIN';
        if (user.permissions?.includes('workorders:site_only') && !isSuperAdmin) {
            if (existingWO.siteId !== user.siteId) {
                return NextResponse.json({ error: 'Forbidden: Restricted to your Site' }, { status: 403 });
            }
        }
        if (user.permissions?.includes('workorders:department_only') && !isSuperAdmin) {
            if (existingWO.departmentId !== user.departmentId) {
                return NextResponse.json({ error: 'Forbidden: Restricted to your Department' }, { status: 403 });
            }
        }

        const body = await request.json();

        if (!body.employeeId) {
            return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
        }

        const workOrder = await workOrderRepo.assign(id, body.employeeId, body.role, user.id);

        await workOrderRepo.addUpdate({
            workOrderId: id,
            updateType: 'NOTE',
            message: `Work order assigned to employee ${body.employeeId}`,
            createdById: user.id,
        });

        return NextResponse.json({
            success: true,
            data: workOrder,
            message: 'Work order assigned successfully',
        });
    } catch (error) {
        console.error('Error assigning work order:', error);
        return NextResponse.json({ error: 'Failed to assign work order' }, { status: 500 });
    }
}
