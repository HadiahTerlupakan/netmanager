import { prisma } from '@/modules/database';
import { getWorkOrderService, type UserContext } from '@/modules/work-order';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api';
import { logger } from '@/lib/logger';
import { createNotification } from '@/modules/notification';
import { onWorkOrderUpdated } from '@/modules/work-order';

// GET /api/admin/workorders/[id]/tasks - Get tasks
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
    const user = ctx.session!.user;
    const { id } = ctx.params;

    if (!await hasPermission('list:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat tasks');
    }

    // Fetch user details for context
    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { siteId: true, departmentId: true, role: true }
    });
    if (!dbUser) return ApiErrors.unauthorized();

    const userContext: UserContext = {
        id: user.id,
        role: user.role,
        permissions: ctx.permissions,
        siteId: dbUser.siteId || undefined,
        departmentId: dbUser.departmentId || undefined,
    }

    const workOrderService = getWorkOrderService();
    const result = await workOrderService.getWorkOrderById(id, userContext);

    if (!result.success) {
        return ApiErrors.notFound('Work Order');
    }

    return apiSuccess(result.data?.tasks || []);
})

// POST /api/admin/workorders/[id]/tasks - Add task
export const POST = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user;
    const { id } = ctx.params;

    if (!await hasPermission('list:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk menambah task');
    }

    const body = await req.json();

    if (!body.title) {
        return apiError('Judul task wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 });
    }

    // Fetch user details for context
    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { siteId: true, departmentId: true, role: true }
    });
    if (!dbUser) return ApiErrors.unauthorized();

    const userContext: UserContext = {
        id: user.id,
        role: user.role,
        permissions: ctx.permissions,
        siteId: dbUser.siteId || undefined,
        departmentId: dbUser.departmentId || undefined,
    }

    const workOrderService = getWorkOrderService();
    const result = await workOrderService.addTask(id, {
        title: body.title,
        description: body.description,
        order: body.order,
    }, userContext);

    if (!result.success) {
        return apiError(result.error || 'Gagal menambah task', ErrorCodes.INTERNAL_ERROR, { status: 500 });
    }

    const task = result.data as { id: string; title: string; order: number };

    // Log activity
    await logger.logActivity({
        action: 'CREATE',
        subject: 'Work Order Task',
        details: {
            workOrderId: id,
            taskId: task.id,
            taskTitle: task.title,
            order: task.order
        },
        userId: user.id
    });

    // Real-time update
    const { socketEmitter } = await import('@/lib/websocket/emitter');
    const woResult = await workOrderService.getWorkOrderById(id, userContext);
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

        if (woForNotify?.assignedTo?.isActive) {
            try {
                // Check if user is on leave
                const now = new Date();
                const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const isOnLeave = await prisma.leaveRequest.findFirst({
                    where: {
                        userId: woForNotify.assignedTo.id,
                        status: 'APPROVED',
                        startDate: { lte: now },
                        endDate: { gte: startOfToday }
                    }
                });

                const title = `Tugas Baru: ${woForNotify.workOrderNumber}`;
                const message = `Admin menambahkan tugas: "${body.title}"`;
                await createNotification({
                    type: 'WORK_ORDER',
                    priority: 'NORMAL',
                    title,
                    message,
                    link: `/admin/workorders/${id}`,
                    userId: woForNotify.assignedTo.id,
                    sourceType: 'WORK_ORDER',
                    sourceId: id,
                    skipExpoPush: Boolean(isOnLeave),
                });

                await onWorkOrderUpdated({
                    id: woResult.data.id,
                    workOrderNumber: woResult.data.workOrderNumber,
                    title: woResult.data.title,
                    type: woResult.data.type,
                    priority: woResult.data.priority,
                    departmentId: woResult.data.departmentId,
                    siteId: woResult.data.siteId,
                    assignedToId: woResult.data.assignedToId,
                }, message, user.name || 'Admin', user.id, [woForNotify.assignedTo.id]);
            } catch (notifyError) {
                console.error('Failed to send task notification:', notifyError);
            }
        }
    }

    return apiSuccess(task, { status: 201, message: 'Task berhasil ditambahkan' });
})
