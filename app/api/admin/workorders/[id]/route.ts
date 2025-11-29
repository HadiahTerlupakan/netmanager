import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { WorkOrderRepository } from '@/lib/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';

const prisma = new PrismaClient();
const workOrderRepo = new WorkOrderRepository(prisma);

// GET /api/admin/workorders/[id] - Get work order detail
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = await verifyAuth(request);
        if (!user || user.role === 'USER') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const workOrder = await workOrderRepo.findById(params.id);

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
    { params }: { params: { id: string } }
) {
    try {
        const user = await verifyAuth(request);
        if (!user || user.role === 'USER') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        // Handle status change separately if provided
        if (body.status) {
            await workOrderRepo.updateStatus(params.id, body.status, user.id);
            delete body.status;
        }

        // Update other fields if any
        if (Object.keys(body).length > 0) {
            await workOrderRepo.update(params.id, body);
        }

        const workOrder = await workOrderRepo.findById(params.id);

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
    { params }: { params: { id: string } }
) {
    try {
        const user = await verifyAuth(request);
        if (!user || user.role === 'USER') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const reason = searchParams.get('reason') || 'Cancelled by admin';

        await workOrderRepo.cancel(params.id, reason, user.id);

        return NextResponse.json({
            success: true,
            message: 'Work order cancelled successfully',
        });
    } catch (error) {
        console.error('Error cancelling work order:', error);
        return NextResponse.json({ error: 'Failed to cancel work order' }, { status: 500 });
    }
}
