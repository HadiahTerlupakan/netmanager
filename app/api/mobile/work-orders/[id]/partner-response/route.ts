import { NextRequest, NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';
import { socketEmitter } from '@/lib/websocket/emitter';
import { randomUUID } from 'crypto';
import { notifyAdminsAboutMobileAction } from '@/modules/notification';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return NextResponse.json({ error: 'Format token tidak valid' }, { status: 401 });
        }

        const payload = await verifyMobileToken(token);

        if (!payload || !payload.id) {
            return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 });
        }

        const body = await request.json();
        const { response } = body;

        if (!['APPROVED', 'REJECTED'].includes(response)) {
            return NextResponse.json({ error: 'Response tidak valid' }, { status: 400 });
        }

        // Find assignment
        const assignment = await prisma.workOrderAssignments.findFirst({
            where: {
                workOrderId: id,
                userId: payload.id as string,
                role: 'PARTNER'
            }
        });

        if (!assignment) {
            return NextResponse.json({ error: 'Assignment tidak ditemukan' }, { status: 404 });
        }

        const updatedAssignment = await prisma.workOrderAssignments.update({
            where: { id: assignment.id },
            data: { status: response }
        });

        // Log update
        await prisma.workOrderUpdates.create({
            data: {
                id: randomUUID(),
                workOrderId: id,
                updateType: 'PARTNER_RESPONSE',
                message: `Partner ${response === 'APPROVED' ? 'menerima' : 'menolak'} permintaan`,
                createdById: payload.id as string
            }
        });

        // Notify Work Order Creator/Assigner
        if (assignment.assignedById) {
            await prisma.notifications.create({
                data: {
                    id: randomUUID(),
                    userId: assignment.assignedById,
                    type: 'PARTNER_RESPONSE',
                    title: 'Respon Partner Kerja',
                    message: `${payload.name || 'Partner'} telah ${response === 'APPROVED' ? 'menerima' : 'menolak'} permintaan partner kerja.`,
                    link: `/karyawan/work-order/${id}`,
                    sourceType: 'WORK_ORDER',
                    sourceId: id
                }
            });
        }

        // Get work order for WebSocket emit
        const workOrder = await prisma.workOrders.findUnique({
            where: { id },
            select: { workOrderNumber: true, title: true, assignedToId: true, departmentId: true, siteId: true }
        });

        // Emit WebSocket to notify in real-time
        if (workOrder) {
            // Emit to WO room for anyone viewing this WO
            socketEmitter.workOrderActivity(id, {
                id: `partner-response-${Date.now()}`,
                type: 'update',
                updateType: 'PARTNER_RESPONSE',
                message: `Partner ${response === 'APPROVED' ? 'menerima' : 'menolak'} undangan`,
                createdAt: new Date().toISOString(),
                createdBy: { id: payload.id as string, name: payload.name as string }
            });

            // Emit update to assignedTo user so they get notified
            socketEmitter.updateWorkOrder({
                id,
                workOrderNumber: workOrder.workOrderNumber,
                title: workOrder.title,
                type: 'PARTNER_RESPONSE',
                status: response,
                priority: 'NORMAL'
            });

            // Also directly notify the assignedTo user
            if (workOrder.assignedToId) {
                socketEmitter.workOrderAssigned({
                    id,
                    workOrderNumber: workOrder.workOrderNumber,
                    title: workOrder.title,
                    type: 'PARTNER_RESPONSE',
                    status: response,
                    priority: 'NORMAL'
                }, workOrder.assignedToId);
            }

            // Also notify the partner user who responded so their list refreshes
            socketEmitter.workOrderAssigned({
                id,
                workOrderNumber: workOrder.workOrderNumber,
                title: workOrder.title,
                type: 'PARTNER_RESPONSE',
                status: response,
                priority: 'NORMAL'
            }, payload.id as string);

            // Notify Admin Portal about partner response
            await notifyAdminsAboutMobileAction({
                workOrderId: id,
                workOrderNumber: workOrder.workOrderNumber,
                title: workOrder.title,
                actionType: 'PARTNER_RESPONSE',
                actionMessage: response === 'APPROVED' ? 'Menerima undangan sebagai partner kerja' : 'Menolak undangan sebagai partner kerja',
                triggeredByUserId: payload.id as string,
                triggeredByName: (payload.name as string) || 'Unknown',
                ...(workOrder.departmentId && { departmentId: workOrder.departmentId }),
                ...(workOrder.siteId && { siteId: workOrder.siteId }),
            });
        }

        return NextResponse.json({
            success: true,
            data: updatedAssignment
        });

    } catch (error) {
        console.error('Partner Response Error:', error);
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
    }
}
