import { NextRequest, NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { createNotification } from '@/modules/notification';
import { sendPushToUsers } from '@/modules/notification/services/ExpoPushService';
import { logActivitySafe } from '@/lib/logger';

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
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            return NextResponse.json({ error: 'Format token tidak valid' }, { status: 401 });
        }

        const payload = await verifyMobileToken(token);
        if (!payload) {
            return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
        }

        const userId = payload.id as string;
        const userName = payload.name as string;

        const body = await request.json();

        // Validation
        if (!body.type || !body.title || !body.description) {
            return NextResponse.json(
                { error: 'Tipe, judul, dan deskripsi wajib diisi' },
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
            ...(body.siteId && { siteId: body.siteId }),
            ...(!body.siteId && payload.siteId && { siteId: payload.siteId as string }),
            contactName: body.contactName || userName,
            contactPhone: body.contactPhone,
            locationAddress: body.locationAddress,
            ...(body.latitude && { locationLat: parseFloat(body.latitude) }),
            ...(body.longitude && { locationLng: parseFloat(body.longitude) }),
            internalNotes: body.notes,
            requestedById: userId,
        });

        // WebSocket broadcast to portal admin for realtime update
        try {
            const { socketEmitter } = await import('@/lib/websocket/emitter');
            socketEmitter.newWorkOrder({
                id: workOrder.id,
                workOrderNumber: workOrder.workOrderNumber,
                title: workOrder.title,
                type: workOrder.type,
                status: workOrder.status,
                priority: workOrder.priority,
                ...(workOrder.departmentId && {
                    departmentId: workOrder.departmentId,
                    department: { id: workOrder.departmentId, name: '' }
                }),
                assignedToId: workOrder.assignedToId || null,
                createdAt: workOrder.createdAt.toISOString()
            }, workOrder.departmentId || undefined, workOrder.siteId || undefined);
            console.log('[Mobile WO Request] WebSocket broadcast sent to portal admin');
        } catch (wsError) {
            console.error('[Mobile WO Request] WebSocket broadcast failed:', wsError);
        }

        // Notify admins with workorders permissions (approve_request OR read OR create)
        try {
            const adminsWithPermission = await prisma.user.findMany({
                where: {
                    isActive: true,
                    role: {
                        permission: {
                            some: {
                                resource: 'workorders',
                                action: { in: ['approve_request', 'read', 'create'] }
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
                        link: `/admin/workorders/list?status=REQUESTED`,
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
        logActivitySafe({
            action: 'CREATE',
            subject: 'Work Order Request',
            userId: userId,
            details: { 
                id: workOrder.id, 
                number: workOrder.workOrderNumber, 
                title: workOrder.title,
                status: 'REQUESTED'
            }
        })

        return NextResponse.json({
            success: true,
            data: workOrder,
            message: 'Work Order request berhasil diajukan. Menunggu persetujuan Admin.',
        }, { status: 201 });

    } catch (error) {
        console.error('Error creating work order request:', error);
        return NextResponse.json(
            { error: 'Gagal membuat permintaan work order' },
            { status: 500 }
        );
    }
}
