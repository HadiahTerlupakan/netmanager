import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/lib/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';

const workOrderRepo = new WorkOrderRepository(prisma);

// PATCH /api/employee/workorders/[id]/tasks/[taskId] - Complete or reopen task
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; taskId: string }> }
) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id, taskId } = await params;
        const body = await request.json();
        const { completed } = body;

        // Get employee from user
        const employee = await prisma.employee.findFirst({
            where: { userId: user.id },
        });

        if (!employee) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
        }

        // Verify work order exists and is assigned to this employee
        const workOrder = await workOrderRepo.findById(id);
        if (!workOrder) {
            return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
        }

        if (workOrder.assignedToId !== employee.id) {
            return NextResponse.json(
                { error: 'You can only modify tasks on work orders assigned to you' },
                { status: 403 }
            );
        }

        // Verify task exists and belongs to this work order
        const task = await prisma.workOrderTask.findFirst({
            where: { id: taskId, workOrderId: id },
        });

        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        let result;
        if (completed) {
            // Mark task as completed
            result = await workOrderRepo.completeTask(taskId, employee.id);
        } else {
            // Reopen task
            result = await prisma.workOrderTask.update({
                where: { id: taskId },
                data: {
                    status: 'PENDING',
                    completedById: null,
                    completedAt: null,
                },
            });
        }

        // Add update to timeline
        await workOrderRepo.addUpdate({
            workOrderId: id,
            updateType: 'PROGRESS_UPDATE',
            message: completed
                ? `Task "${task.title}" completed`
                : `Task "${task.title}" reopened`,
            createdById: employee.id,
        });

        return NextResponse.json({
            success: true,
            data: result,
            message: completed ? 'Task completed' : 'Task reopened',
        });
    } catch (error) {
        console.error('Error updating task:', error);
        return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }
}
