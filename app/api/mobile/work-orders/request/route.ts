import { prisma } from '@/lib/prisma';
import { apiSuccess, apiError, createHandler, ErrorCodes } from '@/lib/api';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import type { CreateWorkOrderData } from '@/modules/work-order/repositories/IWorkOrderRepository';
import { createNotification } from '@/modules/notification';
import { sendPushToUsers } from '@/modules/notification/services/ExpoPushService';

const workOrderRepo = new WorkOrderRepository(prisma);

/**
 * POST /api/mobile/work-orders/request
 * Create a Work Order Request from Mobile App
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
    const userSession = ctx.session!.user;
    const userId = userSession.id;
    const userName = userSession.name || 'Unknown';
    const tenantId = userSession.tenantId as string;

    const body = await req.json();
    ctx.validated = body; // Sync for audit log

    // Validation
    if (!body.type || !body.title || !body.description) {
        return apiError('Tipe, judul, dan deskripsi wajib diisi', ErrorCodes.BAD_REQUEST, { status: 400 });
    }

    // Get departmentId
    let departmentId = body.departmentId;
    if (!departmentId) {
        const dbUser = await prisma.user.findFirst({
            where: { id: userId, tenantId },
            select: { departmentId: true }
        });
        departmentId = dbUser?.departmentId;
    }
    if (!departmentId) {
        const firstDept = await prisma.departments.findFirst({
            where: { tenantId },
            select: { id: true }
        });
        departmentId = firstDept?.id;
    }

    // Create the WO Request
    const workOrder = await workOrderRepo.createRequest({
        type: body.type,
        title: body.title,
        description: body.description,
        priority: body.priority || 'NORMAL',
        departmentId: departmentId,
        ...(body.siteId && { siteId: body.siteId }),
        ...(!body.siteId && userSession.siteId && { siteId: userSession.siteId }),
        contactName: body.contactName || userName,
        contactPhone: body.contactPhone,
        locationAddress: body.locationAddress,
        ...(body.latitude && { locationLat: parseFloat(body.latitude) }),
        ...(body.longitude && { locationLng: parseFloat(body.longitude) }),
        internalNotes: body.notes,
        requestedById: userId,
        tenantId: tenantId,
    } as CreateWorkOrderData & { requestedById: string });

    // WebSocket broadcast
    try {
        const { socketEmitter } = await import('@/lib/websocket/emitter');
        socketEmitter.newWorkOrder({
            id: workOrder.id,
            workOrderNumber: workOrder.workOrderNumber,
            title: workOrder.title,
            type: workOrder.type,
            status: workOrder.status,
            priority: workOrder.priority,
            ...(workOrder.departmentId && { departmentId: workOrder.departmentId, department: { id: workOrder.departmentId, name: '' } }),
            assignedToId: workOrder.assignedToId || null,
            createdAt: workOrder.createdAt.toISOString()
        }, workOrder.departmentId || undefined, workOrder.siteId || undefined);
    } catch (e) { console.error('[Mobile WO Request] Socket error:', e); }

    // Notifications
    try {
        const adminsWithPermission = await prisma.user.findMany({
            where: {
                isActive: true,
                role: {
                    permission: {
                        some: {
                            resource: 'workorders',
                            action: { in: ['approve_request', 'read', 'create'] },
                            tenantId
                        }
                    }
                }
            },
            select: { id: true }
        });

        const adminIds = adminsWithPermission.map(a => a.id);
        if (adminIds.length > 0) {
            await Promise.all(adminIds.map(adminId =>
                createNotification({
                    type: 'WORK_ORDER',
                    priority: 'NORMAL',
                    title: '📝 WO Request Baru',
                    message: `${userName} mengajukan: ${workOrder.title}`,
                    link: `/admin/workorders/list?status=REQUESTED`,
                    userId: adminId,
                    sourceType: 'WORK_ORDER',
                    sourceId: workOrder.id,
                }).catch(e => console.error('Notification error:', e))
            ));

            await sendPushToUsers(adminIds, '📝 WO Request Baru', `${userName} mengajukan: ${workOrder.title}`, { 
                workOrderId: workOrder.id, 
                type: 'WO_REQUEST',
                screen: 'WorkOrderRequests'
            }).catch(e => console.error('Push error:', e));
        }
    } catch (e) { console.error('Notify admins error:', e); }

    return apiSuccess(workOrder, { message: 'Work Order request berhasil diajukan. Menunggu persetujuan Admin.', status: 201 });
});
