import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { requireAuth } from '@/lib/auth-helpers';
import { hasPermission } from '@/lib/rbac';
import { createNotification } from '@/modules/notification';
import { sendPushToUsers } from '@/modules/notification/services/ExpoPushService';

const workOrderRepo = new WorkOrderRepository(prisma);

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
        if (!await hasPermission('workorders:requests:approve')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();

        if (!body.action || !['APPROVE', 'REJECT'].includes(body.action)) {
            return NextResponse.json(
                { error: 'Action must be APPROVE or REJECT' },
                { status: 400 }
            );
        }

        if (body.action === 'REJECT' && !body.reason) {
            return NextResponse.json(
                { error: 'Reason is required when rejecting' },
                { status: 400 }
            );
        }

        // Get the WO before action for notification
        const existingWO = await workOrderRepo.findById(id);
        if (!existingWO) {
            return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
        }

        if (existingWO.status !== 'REQUESTED') {
            return NextResponse.json(
                { error: `Cannot ${body.action.toLowerCase()}: Work order is not in REQUESTED status` },
                { status: 400 }
            );
        }

        let result;
        let notificationTitle: string;
        let notificationMessage: string;

        if (body.action === 'APPROVE') {
            result = await workOrderRepo.approveRequest(id, user.user.id);
            notificationTitle = '✅ WO Request Disetujui';
            notificationMessage = `Request Anda "${existingWO.title}" telah disetujui dan siap dikerjakan.`;
        } else {
            result = await workOrderRepo.rejectRequest(id, user.user.id, body.reason);
            notificationTitle = '❌ WO Request Ditolak';
            notificationMessage = `Request Anda "${existingWO.title}" ditolak: ${body.reason}`;
        }

        // Notify the requester
        if (existingWO.requestedById) {
            try {
                // In-app notification
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

                // Push notification
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

        // System Log
        try {
            const { logger } = await import('@/lib/logger');
            await logger.logActivity({
                action: body.action === 'APPROVE' ? 'APPROVE' : 'REJECT',
                subject: 'Work Order Request',
                userId: user.user.id,
                details: {
                    id,
                    number: existingWO.workOrderNumber,
                    action: body.action,
                    reason: body.reason,
                }
            });
        } catch (e) {
            console.error('Logging failed', e);
        }

        return NextResponse.json({
            success: true,
            data: result,
            message: body.action === 'APPROVE'
                ? 'Work order request berhasil disetujui'
                : 'Work order request ditolak',
        });
    } catch (error: any) {
        console.error('Error processing work order request:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to process work order request' },
            { status: 500 }
        );
    }
}
