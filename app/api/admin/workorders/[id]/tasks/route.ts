import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/lib/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';

const workOrderRepo = new WorkOrderRepository(prisma);

// GET /api/admin/workorders/[id]/tasks - Get tasks
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request);
        if (!user || user.role === 'USER') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const workOrder = await workOrderRepo.findById(id);
        if (!workOrder) {
            return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: workOrder.tasks || [],
        });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }
}

// POST /api/admin/workorders/[id]/tasks - Add task
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request);
        if (!user || user.role === 'USER') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();

        if (!body.title) {
            return NextResponse.json({ error: 'Task title is required' }, { status: 400 });
        }

        const task = await workOrderRepo.addTask({
            workOrderId: id,
            title: body.title,
            description: body.description,
            order: body.order,
        });

        return NextResponse.json({
            success: true,
            data: task,
            message: 'Task added successfully',
        }, { status: 201 });
    } catch (error) {
        console.error('Error adding task:', error);
        return NextResponse.json({ error: 'Failed to add task' }, { status: 500 });
    }
}
