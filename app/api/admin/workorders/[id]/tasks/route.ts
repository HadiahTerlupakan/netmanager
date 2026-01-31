import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkOrderService } from '@/modules/work-order';
import { verifyAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response';

// GET /api/admin/workorders/[id]/tasks - Get tasks
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('list:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat tasks');
        }

        const { id } = await params;
        const workOrderService = getWorkOrderService();
        const result = await workOrderService.getWorkOrderById(id);

        if (!result.success) {
            return ApiErrors.notFound('Work Order');
        }

        return apiSuccess(result.data?.tasks || []);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        return ApiErrors.internalError('Gagal mengambil tasks');
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
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('list:update')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk menambah task');
        }

        const { id } = await params;
        const body = await request.json();

        if (!body.title) {
            return apiError('Judul task wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 });
        }

        const workOrderService = getWorkOrderService();
        const result = await workOrderService.addTask(id, {
            title: body.title,
            description: body.description,
            order: body.order,
        });

        if (!result.success) {
            return apiError(result.error || 'Gagal menambah task', ErrorCodes.INTERNAL_ERROR, { status: 500 });
        }

        const task = result.data!;

        // Real-time update
        const { socketEmitter } = await import('@/lib/websocket/emitter');
        const woResult = await workOrderService.getWorkOrderById(id);
        if (woResult.success && woResult.data) {
            socketEmitter.updateWorkOrder(woResult.data as unknown as Parameters<typeof socketEmitter.updateWorkOrder>[0]);

            // Send Push Notification
            const woForNotify = await prisma.workOrders.findUnique({
                where: { id },
                select: {
                    workOrderNumber: true,
                    assignedTo: {
                        select: { id: true, pushToken: true, isActive: true }
                    }
                }
            });

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

        return apiSuccess(task, { status: 201, message: 'Task berhasil ditambahkan' });
    } catch (error) {
        console.error('Error adding task:', error);
        return ApiErrors.internalError('Gagal menambah task');
    }
}
