import { NextRequest, NextResponse } from 'next/server';
import { getWorkOrderService } from '@/modules/work-order';
import { requireAuth } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/rbac';
import { createNotification } from '@/modules/notification';
import { sendPushToUsers } from '@/modules/notification/services/ExpoPushService';
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response';

/**
 * POST /api/admin/workorders/[id]/approve
 * Approve or Reject a Work Order Request
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth(request);
        if (user instanceof NextResponse) {
            return user;
        }

        // Permission check
        const hasApprovePermission = await hasPermission('workorders:approve_request') || 
                                      await hasPermission('list:approve_request') ||
                                      await hasPermission('workorders:requests:approve');
        if (!hasApprovePermission) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk approve/reject work order');
        }

        const { id } = await params;
        const body = await request.json();

        if (!body.action || !['APPROVE', 'REJECT'].includes(body.action)) {
            return apiError('Action harus APPROVE atau REJECT', ErrorCodes.VALIDATION_ERROR, { status: 400 });
        }

        if (body.action === 'REJECT' && !body.reason) {
            return apiError('Alasan wajib diisi saat menolak', ErrorCodes.VALIDATION_ERROR, { status: 400 });
        }

        const workOrderService = getWorkOrderService();

        // Get WO for notification before action
        const getResult = await workOrderService.getWorkOrderById(id);
        if (!getResult.success) {
            return ApiErrors.notFound('Work Order');
        }
        const existingWO = getResult.data!;

        // Execute action via service
        let result;
        let notificationTitle: string;
        let notificationMessage: string;

        if (body.action === 'APPROVE') {
            result = await workOrderService.approveRequest(id, user.user.id);
            notificationTitle = '✅ WO Request Disetujui';
            notificationMessage = `Request Anda "${existingWO.title}" telah disetujui dan siap dikerjakan.`;
        } else {
            result = await workOrderService.rejectRequest(id, user.user.id, body.reason);
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
    } catch (error: any) {
        console.error('Error processing work order request:', error);
        return ApiErrors.internalError('Gagal memproses work order request');
    }
}
