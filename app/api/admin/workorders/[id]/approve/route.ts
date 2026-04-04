import { getWorkOrderService, type UserContext } from '@/modules/work-order';
import { hasPermission } from '@/lib/rbac';
import { createNotification } from '@/modules/notification';
import { sendPushToUsers } from '@/modules/notification';
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api';

/**
 * POST /api/admin/workorders/[id]/approve
 * Approve or Reject a Work Order Request
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user;
    const { id } = ctx.params;

    // Permission check
    const hasApprovePermission = await hasPermission('workorders:approve_request') || 
                                  await hasPermission('list:approve_request') ||
                                  await hasPermission('workorders:requests:approve');
    if (!hasApprovePermission) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk approve/reject work order');
    }

    const body = await req.json();

    if (!body.action || !['APPROVE', 'REJECT'].includes(body.action)) {
        return apiError('Action harus APPROVE atau REJECT', ErrorCodes.VALIDATION_ERROR, { status: 400 });
    }

    if (body.action === 'REJECT' && !body.reason) {
        return apiError('Alasan wajib diisi saat menolak', ErrorCodes.VALIDATION_ERROR, { status: 400 });
    }

    const workOrderService = getWorkOrderService();

    // Fetch full user to be safe for UserContext compatibility
    const { prisma: db } = await import('@/modules/database');
    const dbUser = await db.user.findUnique({
        where: { id: user.id },
        select: { id: true, departmentId: true, siteId: true }
    });
    
    if (!dbUser) return ApiErrors.unauthorized();

    const userContext: UserContext = {
        id: user.id,
        role: user.role,
        permissions: ctx.permissions,
        siteId: dbUser.siteId || undefined,
        departmentId: dbUser.departmentId || undefined,
    }

    const getResult = await workOrderService.getWorkOrderById(id, userContext);
    if (!getResult.success) {
        return ApiErrors.notFound('Work Order');
    }
    const existingWO = getResult.data!;

    // Execute action via service
    let result;
    let notificationTitle: string;
    let notificationMessage: string;

    if (body.action === 'APPROVE') {
        result = await workOrderService.approveRequest(id, userContext);
        notificationTitle = '✅ WO Request Disetujui';
        notificationMessage = `Request Anda "${existingWO.title}" telah disetujui and siap dikerjakan.`;
    } else {
        result = await workOrderService.rejectRequest(id, userContext, body.reason);
        notificationTitle = '❌ WO Request Ditolak';
        notificationMessage = `Request Anda "${existingWO.title}" ditolak: ${body.reason}`;
    }

    if (!result.success) {
        const statusCode = result.code === 'INVALID_STATUS' ? 400 : 500;
        return apiError(result.error || 'Gagal memproses request', ErrorCodes.INTERNAL_ERROR, { status: statusCode });
    }

    // Notify the requester (custom logic for this endpoint)
    if (existingWO.requestedById) {
        try {
            await createNotification({
                type: 'WORK_ORDER',
                priority: body.action === 'REJECT' ? 'HIGH' : 'NORMAL',
                title: notificationTitle,
                message: notificationMessage,
                link: `/admin/workorders/${id}`,
                userId: existingWO.requestedById,
                sourceType: 'WORK_ORDER',
                sourceId: id,
            });

            await sendPushToUsers(
                [existingWO.requestedById],
                notificationTitle,
                notificationMessage,
                {
                    workOrderId: id,
                    type: 'WO_REQUEST_RESULT',
                    action: body.action,
                    screen: 'WorkOrderDetail'
                }
            );
        } catch (notifyError) {
            console.error('Failed to notify requester:', notifyError);
        }
    }

    return apiSuccess(result.data, {
        message: body.action === 'APPROVE'
            ? 'Work order request berhasil disetujui'
            : 'Work order request ditolak',
    });
})
