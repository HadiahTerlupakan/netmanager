import { NextRequest, NextResponse } from 'next/server';
import { verifyMobileToken } from '@/lib/mobile-auth';
import { prisma } from '@/lib/prisma';
import { socketEmitter } from '@/lib/websocket/emitter';

// POST: Add Partner
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const payload = await verifyMobileToken(token);

        if (!payload || !payload.id) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const body = await request.json();
        const { userId, role } = body;

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const assignment = await prisma.workOrderAssignment.create({
            data: {
                workOrderId: id,
                userId: userId,
                role: role || 'PARTNER',
                status: 'PENDING', // Require approval
                assignedById: payload.id as string
            }
        });

        // Create Notification
        await prisma.notification.create({
            data: {
                userId: userId,
                type: 'PARTNER_REQUEST',
                title: 'Permintaan Partner Kerja',
                message: `Anda diminta menjadi partner kerja di Work Order. Silakan berikan tanggapan.`,
                link: `/mobile/work-order-detail/${id}`, // Mobile deep link path
                sourceType: 'WORK_ORDER',
                sourceId: id
            }
        });

        // Add log update
        await prisma.workOrderUpdate.create({
            data: {
                workOrderId: id,
                updateType: 'ASSIGNMENT',
                message: `Added partner (Pending Approval)`,
                createdById: payload.id as string
            }
        });

        // Get work order for notification
        const workOrder = await prisma.workOrder.findUnique({
            where: { id },
            select: { workOrderNumber: true, title: true }
        });

        // Emit WebSocket to notify partner user in real-time
        if (workOrder) {
            socketEmitter.updateWorkOrder({
                id,
                workOrderNumber: workOrder.workOrderNumber,
                title: workOrder.title,
                type: 'PARTNER_INVITATION',
                status: 'PENDING',
                priority: 'NORMAL'
            });
        }

        // Also notify the partner user directly
        socketEmitter.workOrderAssigned({
            id,
            workOrderNumber: workOrder?.workOrderNumber || '',
            title: workOrder?.title || '',
            type: 'PARTNER_INVITATION',
            status: 'PENDING',
            priority: 'NORMAL'
        }, userId);

        return NextResponse.json({
            success: true,
            data: assignment
        });

    } catch (error) {
        console.error('Add Partner Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE: Remove Partner
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split(' ')[1];
        const payload = await verifyMobileToken(token);

        if (!payload || !payload.id) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const assignmentId = searchParams.get('assignmentId');
        const userId = searchParams.get('userId');

        if (!assignmentId && !userId) {
            return NextResponse.json({ error: 'Assignment ID or User ID is required' }, { status: 400 });
        }

        // Find the assignment first to get the userId before deleting
        const whereClause = assignmentId
            ? { id: assignmentId }
            : { workOrderId: id, userId: userId! };

        const assignmentToDelete = await prisma.workOrderAssignment.findFirst({
            where: whereClause,
            select: { userId: true }
        });

        const partnerUserId = assignmentToDelete?.userId || userId;

        await prisma.workOrderAssignment.deleteMany({
            where: whereClause
        });

        // Add log update
        await prisma.workOrderUpdate.create({
            data: {
                workOrderId: id,
                updateType: 'ASSIGNMENT',
                message: `Removed partner`,
                createdById: payload.id as string
            }
        });

        // Get work order for WebSocket emit
        const workOrder = await prisma.workOrder.findUnique({
            where: { id },
            select: { workOrderNumber: true, title: true }
        });

        // Emit WebSocket to notify the removed partner user in real-time
        if (workOrder && partnerUserId) {
            socketEmitter.workOrderAssigned({
                id,
                workOrderNumber: workOrder.workOrderNumber,
                title: workOrder.title,
                type: 'PARTNER_REMOVED',
                status: 'REMOVED',
                priority: 'NORMAL'
            }, partnerUserId);

            // Also emit general update for WO room
            socketEmitter.updateWorkOrder({
                id,
                workOrderNumber: workOrder.workOrderNumber,
                title: workOrder.title,
                type: 'PARTNER_REMOVED',
                status: 'UPDATED',
                priority: 'NORMAL'
            });
        }

        return NextResponse.json({
            success: true
        });

    } catch (error) {
        console.error('Remove Partner Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
