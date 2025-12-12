import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/lib/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';

const workOrderRepo = new WorkOrderRepository(prisma);

// GET /api/admin/workorders/[id] - Get work order detail
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const workOrder = await workOrderRepo.findById(id);

        if (!workOrder) {
            return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: workOrder,
        });
    } catch (error) {
        console.error('Error fetching work order:', error);
        return NextResponse.json({ error: 'Failed to fetch work order' }, { status: 500 });
    }
}

// PATCH /api/admin/workorders/[id] - Update work order
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();

        // Handle rejection reason or explicitly provided reason
        if (body.rejectionReason) {
            await workOrderRepo.addUpdate({
                workOrderId: id,
                updateType: 'NOTE',
                message: `[REJECTED] ${body.rejectionReason}`,
                createdById: user.id,
            });
            delete body.rejectionReason;
        }

        // Handle status change separately if provided
        if (body.status) {
            await workOrderRepo.updateStatus(id, body.status, user.id);
            delete body.status;
        }

        // Update other fields if any
        if (Object.keys(body).length > 0) {
            await workOrderRepo.update(id, body);
        }

        const workOrder = await workOrderRepo.findById(id);

        return NextResponse.json({
            success: true,
            data: workOrder,
            message: 'Work order updated successfully',
        });
    } catch (error) {
        console.error('Error updating work order:', error);
        return NextResponse.json({ error: 'Failed to update work order' }, { status: 500 });
    }
}

// DELETE /api/admin/workorders/[id] - Delete/cancel work order
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const reason = searchParams.get('reason') || 'Cancelled by admin';

        await workOrderRepo.cancel(id, reason, user.id);

        return NextResponse.json({
            success: true,
            message: 'Work order cancelled successfully',
        });
    } catch (error) {
        console.error('Error cancelling work order:', error);
        return NextResponse.json({ error: 'Failed to cancel work order' }, { status: 500 });
    }
}
