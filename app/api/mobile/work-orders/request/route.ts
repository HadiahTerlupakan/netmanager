import { NextRequest, NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { createNotification } from '@/modules/notification';
import { sendPushToUsers } from '@/modules/notification/services/ExpoPushService';

const workOrderRepo = new WorkOrderRepository(prisma);

/**
 * POST /api/mobile/work-orders/request
 * Create a Work Order Request from Mobile App
 * Status will be REQUESTED (waiting for admin approval)
 */
export async function POST(request: NextRequest) {
    try {
        // Auth Check
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split(' ')[1];
        const payload = await verifyMobileToken(token);
        if (!payload) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const userId = payload.id as string;
        const userName = payload.name as string;

        const body = await request.json();

        // Validation
        if (!body.type || !body.title || !body.description) {
            return NextResponse.json(
                { error: 'Type, title, and description are required' },
                { status: 400 }
            );
        }

        // Get departmentId: from body, user's department, or first available
        let departmentId = body.departmentId;
        if (!departmentId) {
            // Try to get from user's department
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { departmentId: true }
            });
            departmentId = user?.departmentId;
        }
        if (!departmentId) {
            // Fallback to first department
            const firstDept = await prisma.departments.findFirst({
                select: { id: true }
            });
            departmentId = firstDept?.id;
        }

        // Create the WO Request with status REQUESTED
        const workOrder = await workOrderRepo.createRequest({
            type: body.type,
            title: body.title,
            description: body.description,
            priority: body.priority || 'NORMAL',
            departmentId: body.departmentId,
            siteId: body.siteId || (payload.siteId as string) || undefined,
            contactName: body.contactName || userName,
            contactPhone: body.contactPhone,
            locationAddress: body.locationAddress,
            locationLat: body.latitude ? parseFloat(body.latitude) : undefined,
            locationLng: body.longitude ? parseFloat(body.longitude) : undefined,
            internalNotes: body.notes,
            requestedById: userId,
        });

        // Notify admins with workorders:requests:approve permission
        try {
            const adminsWithPermission = await prisma.user.findMany({
                where: {
                    isActive: true,
                    role: {
                        permission: {
                            some: {
                                name: 'workorders:requests:approve'
                            }
                        }
                    }
                },
                select: { id: true, name: true }
            });

            const adminIds = adminsWithPermission.map(a => a.id);
            
            if (adminIds.length > 0) {
                // In-app notifications
                await Promise.all(adminIds.map(adminId =>
                    createNotification({
                        type: 'WORK_ORDER',
                        priority: 'NORMAL',
                        title: '📝 WO Request Baru',
                        message: `${userName} mengajukan: ${workOrder.title}`,
                        link: `/admin/workorders/requests`,
                        userId: adminId,
                        sourceType: 'WORK_ORDER',
                        sourceId: workOrder.id,
                    }).catch(err => console.error('Notification failed:', err))
                ));

                // Push notifications
                await sendPushToUsers(
                    adminIds,
                    '📝 WO Request Baru',
                    `${userName} mengajukan: ${workOrder.title}`,
                    { 
                        workOrderId: workOrder.id, 
                        type: 'WO_REQUEST',
                        screen: 'WorkOrderRequests'
                    }
                ).catch(err => console.error('Push notification failed:', err));
            }
        } catch (notifyError) {
            console.error('Failed to notify admins about WO request:', notifyError);
            // Non-blocking - continue even if notification fails
        }

        // System Log
        try {
            const { logger } = await import('@/lib/logger');
            await logger.logActivity({
                action: 'CREATE',
                subject: 'Work Order Request',
                userId: userId,
                details: { 
                    id: workOrder.id, 
                    number: workOrder.workOrderNumber, 
                    title: workOrder.title,
                    status: 'REQUESTED'
                }
            });
        } catch (e) {
            console.error('Logging failed', e);
        }

        return NextResponse.json({
            success: true,
            data: workOrder,
            message: 'Work Order request berhasil diajukan. Menunggu persetujuan Admin.',
        }, { status: 201 });

    } catch (error) {
        console.error('Error creating work order request:', error);
        return NextResponse.json(
            { error: 'Failed to create work order request' },
            { status: 500 }
        );
    }
}
