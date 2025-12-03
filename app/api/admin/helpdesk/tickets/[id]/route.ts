import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TicketRepository } from '@/lib/repositories/TicketRepository';
import { verifyAuth } from '@/lib/auth';

const ticketRepo = new TicketRepository(prisma);

// GET /api/admin/helpdesk/tickets/[id] - Get ticket detail
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request);
        if (!user || user.role === 'USER') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { id } = await params;
        const ticket = await ticketRepo.findById(id);

        if (!ticket) {
            return NextResponse.json(
                { error: 'Ticket not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: ticket,
        });
    } catch (error) {
        console.error('Error fetching ticket:', error);
        return NextResponse.json(
            { error: 'Failed to fetch ticket' },
            { status: 500 }
        );
    }
}

// PATCH /api/admin/helpdesk/tickets/[id] - Update ticket
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request);
        if (!user || user.role === 'USER') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { id } = await params;
        const body = await request.json();
        const updateData: any = {};

        if (body.categoryId !== undefined) updateData.categoryId = body.categoryId;
        if (body.subject) updateData.subject = body.subject;
        if (body.status) updateData.status = body.status;
        if (body.priority) updateData.priority = body.priority;
        if (body.rating !== undefined) updateData.rating = body.rating;
        if (body.feedback !== undefined) updateData.feedback = body.feedback;

        // Handle assignment separately
        if (body.assignedToId !== undefined) {
            if (body.assignedToId === null) {
                await ticketRepo.unassign(id);
            } else {
                await ticketRepo.assignToUser(id, body.assignedToId);
            }
        }

        const ticket = await ticketRepo.update(id, updateData);

        return NextResponse.json({
            success: true,
            data: ticket,
            message: 'Ticket updated successfully',
        });
    } catch (error) {
        console.error('Error updating ticket:', error);
        return NextResponse.json(
            { error: 'Failed to update ticket' },
            { status: 500 }
        );
    }
}

// POST /api/admin/helpdesk/tickets/[id] - Add message/reply
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request);
        if (!user || user.role === 'USER') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { id } = await params;
        const body = await request.json();

        if (!body.message) {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400 }
            );
        }

        const message = await ticketRepo.addMessage({
            ticketId: id,
            message: body.message,
            isInternal: body.isInternal || false,
            senderType: 'STAFF',
            senderId: user.id,
            senderName: user.name || user.email,
            attachments: body.attachments,
        });

        return NextResponse.json({
            success: true,
            data: message,
            message: body.isInternal ? 'Internal note added' : 'Reply sent successfully',
        }, { status: 201 });
    } catch (error) {
        console.error('Error adding message:', error);
        return NextResponse.json(
            { error: 'Failed to add message' },
            { status: 500 }
        );
    }
}
