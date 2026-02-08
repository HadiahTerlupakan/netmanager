import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getWorkOrderService } from '@/modules/work-order';
import { verifyAuth } from '@/lib/auth';
import { socketEmitter } from '@/lib/websocket/emitter';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response';
import { logger } from '@/lib/logger';

interface ExtendedUser {
  id: string
  name?: string
  role?: string
  permissions?: string[]
  siteId?: string
  departmentId?: string
  employee?: unknown
}

interface CommentData {
  id: string;
  message: string;
  createdAt: Date;
  userId: string;
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await verifyAuth(request);
        if (!session) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        const user = session as unknown as ExtendedUser;

        if (!await hasPermission('list:update')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk menambah komentar');
        }

        const body = await request.json();
        const { message } = body;

        if (!message) {
            return apiError('Pesan wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 });
        }

        // Use service to add comment
        const workOrderService = getWorkOrderService();
        const result = await workOrderService.addComment(id, message, {
            id: user.id,
            role: user.role,
            permissions: user.permissions,
            siteId: user.siteId,
            departmentId: user.departmentId
        });

        if (!result.success) {
            return apiError(result.error || 'Gagal menambah komentar', ErrorCodes.INTERNAL_ERROR, { status: 500 });
        }

        const comment = result.data as CommentData;

        // Log activity
        await logger.logActivity({
            action: 'CREATE',
            subject: 'Work Order Comment',
            details: {
                workOrderId: id,
                commentId: comment.id,
                message: comment.message.substring(0, 100) // Log shortened message
            },
            userId: user.id
        });

        // Emit WebSocket event for real-time Activity Timeline
        socketEmitter.workOrderActivity(id, {
            id: comment.id,
            type: 'comment',
            message: comment.message,
            updateType: 'COMMENT',
            createdAt: comment.createdAt.toISOString(),
            createdBy: user ? {
                id: user.id,
                ...(user.name ? { name: user.name } : {})
            } : null,
        });

        // Send Push Notification to Assigned User
        try {
            const workOrder = await prisma.workOrders.findUnique({
                where: { id },
                include: { assignedTo: true }
            });

            if (workOrder?.assignedTo?.pushToken && workOrder.assignedTo?.isActive) {
                // Check if user is on leave
                const now = new Date();
                const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const isOnLeave = await prisma.leaveRequest.findFirst({
                    where: {
                        userId: workOrder.assignedTo.id,
                        status: 'APPROVED',
                        startDate: { lte: now },
                        endDate: { gte: startOfToday }
                    }
                });

                if (!isOnLeave) {
                    const { sendExpoPushNotifications } = await import('@/lib/expo');

                    const title = `Komentar Baru: ${workOrder.workOrderNumber}`;
                    const notifBody = `${user.name || 'Admin'}: ${message.substring(0, 100)}`;

                    await sendExpoPushNotifications(
                        [workOrder.assignedTo.pushToken],
                        title,
                        notifBody,
                        {
                            type: 'WORK_ORDER',
                            workOrderId: id,
                            url: `/(app)/work-order-detail/${id}`
                        }
                    );
                } else {
                    console.log(`Skipping notification for user ${workOrder.assignedTo.id} (On Leave)`);
                }

                // Persist notification (Always create history)
                await prisma.notifications.create({
                    data: {
                        id: crypto.randomUUID(),
                        type: 'WORK_ORDER',
                        title: `Komentar Baru: ${workOrder.workOrderNumber}`,
                        message: `${user.name || 'Admin'}: ${message.substring(0, 100)}`,
                        userId: workOrder.assignedTo.id,
                        sourceType: 'WORK_ORDER',
                        sourceId: id,
                        isRead: false,
                        priority: 'NORMAL',
                        createdAt: new Date(),
                    }
                });
            }
        } catch (error) {
            console.error('Failed to send comment notification:', error);
        }

        return apiSuccess(comment, { status: 201, message: 'Komentar berhasil ditambahkan' });
    } catch (error) {
        console.error('Error adding comment:', error);
        return ApiErrors.internalError('Gagal menambah komentar');
    }
}
