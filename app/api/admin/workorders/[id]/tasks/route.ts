import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';

const workOrderRepo = new WorkOrderRepository(prisma);

// GET /api/admin/workorders/[id]/tasks - Get tasks
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
        if (!user) {
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

        // Real-time update
        const { socketEmitter } = await import('@/lib/websocket/emitter');
        // We need to fetch the updated WO to emit valid payload
        const updatedWO = await workOrderRepo.findById(id);
        if (updatedWO) {
            socketEmitter.updateWorkOrder(updatedWO as any);

            // Fetch push token specifically (repo.findById excludes it)
            const woForNotify = await prisma.workOrders.findUnique({
                where: { id },
                select: {
                    workOrderNumber: true,
                    assignedTo: {
                        select: { id: true, pushToken: true, isActive: true }
                    }
                }
            });

            // Send Push Notification
            if (woForNotify?.assignedTo?.pushToken && woForNotify.assignedTo.isActive) {
                try {
                    const { sendExpoPushNotifications } = await import('@/lib/expo');
                    const title = `Tugas Baru: ${woForNotify.workOrderNumber}`;
                    const message = `Admin menambahkan tugas: "${body.title}"`;

                    await sendExpoPushNotifications(
                        [woForNotify.assignedTo.pushToken],
                        title,
                        message,
                        {
                            type: 'WORK_ORDER',
                            workOrderId: id,
                            url: `/(app)/work-order-detail/${id}`
                        }
                    );

                    // Create DB Notification
                    await prisma.notifications.create({
                        data: {
                            id: crypto.randomUUID(),
                            type: 'WORK_ORDER',
                            title: title,
                            message: message,
                            userId: woForNotify.assignedTo.id,
                            sourceType: 'WORK_ORDER',
                            sourceId: id,
                            isRead: false,
                            priority: 'NORMAL',
                            createdAt: new Date(),
                        }
                    });
                } catch (notifyError) {
                    console.error('Failed to send task notification:', notifyError);
                }
            }
        }

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
