import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TicketRepository } from '@/lib/repositories/TicketRepository';
import { WorkOrderRepository } from '@/lib/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';

const prisma = new PrismaClient();
const ticketRepo = new TicketRepository(prisma);
const workOrderRepo = new WorkOrderRepository(prisma);

// POST /api/admin/workorders/convert-ticket - Convert ticket to work order
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user || user.role === 'USER') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        if (!body.ticketId) {
            return NextResponse.json({ error: 'Ticket ID is required' }, { status: 400 });
        }

        const ticket = await ticketRepo.findById(body.ticketId);
        if (!ticket) {
            return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
        }

        // Check if work order already exists for this ticket
        const existing = await workOrderRepo.findAll({ ticketId: body.ticketId });
        if (existing.workOrders.length > 0) {
            return NextResponse.json(
                { error: 'Work order already exists for this ticket' },
                { status: 400 }
            );
        }

        const workOrder = await workOrderRepo.createFromTicket(body.ticketId, {
            type: body.type,
            departmentId: body.departmentId,
            assignedToId: body.assignedToId,
            scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : undefined,
            scheduledTimeStart: body.scheduledTimeStart,
            scheduledTimeEnd: body.scheduledTimeEnd,
            priority: body.priority,
        });

        // Update ticket status to IN_PROGRESS
        await ticketRepo.updateStatus(body.ticketId, 'IN_PROGRESS');

        // Add automatic message to ticket informing about work order
        await ticketRepo.addMessage({
            ticketId: body.ticketId,
            message: `Tiket telah dikonversi menjadi Work Order dengan nomor: ${workOrder.workOrderNumber}. Tim teknis akan segera menangani permintaan Anda.`,
            senderType: 'STAFF',
            senderId: user.id,
            senderName: user.name || user.email || 'System',
            isInternal: false, // Public message so customer can see it
        });

        return NextResponse.json({
            success: true,
            data: workOrder,
            message: `Work order ${workOrder.workOrderNumber} berhasil dibuat dan status tiket diubah menjadi sedang dikerjakan`,
        }, { status: 201 });
    } catch (error) {
        console.error('Error converting ticket to work order:', error);
        return NextResponse.json({ error: 'Failed to convert ticket' }, { status: 500 });
    }
}
