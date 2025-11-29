import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { TicketRepository } from '@/lib/repositories/TicketRepository';

const prisma = new PrismaClient();
const ticketRepo = new TicketRepository(prisma);

// GET /api/pelanggan/tickets/[id] - Get detail ticket
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const pelangganData = request.headers.get('pelanggan-data');

        if (!pelangganData) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const pelanggan = JSON.parse(pelangganData);
        const ticket = await ticketRepo.findById(params.id);

        if (!ticket) {
            return NextResponse.json(
                { error: 'Ticket not found' },
                { status: 404 }
            );
        }

        // Verify ticket belongs to this customer
        if (ticket.pelangganId !== pelanggan.id) {
            return NextResponse.json(
                { error: 'Access denied' },
                { status: 403 }
            );
        }

        // Filter out internal messages for customer
        if (ticket.messages) {
            ticket.messages = ticket.messages.filter(msg => !msg.isInternal);
        }

        return NextResponse.json({
            success: true,
            data: ticket,
        });
    } catch (error) {
        console.error('Error fetching ticket detail:', error);
        return NextResponse.json(
            { error: 'Failed to fetch ticket' },
            { status: 500 }
        );
    }
}

// POST /api/pelanggan/tickets/[id] - Add reply/message
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const pelangganData = request.headers.get('pelanggan-data');

        if (!pelangganData) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const pelanggan = JSON.parse(pelangganData);
        const ticket = await ticketRepo.findById(params.id);

        if (!ticket) {
            return NextResponse.json(
                { error: 'Ticket not found' },
                { status: 404 }
            );
        }

        // Verify ticket belongs to this customer
        if (ticket.pelangganId !== pelanggan.id) {
            return NextResponse.json(
                { error: 'Access denied' },
                { status: 403 }
            );
        }

        const body = await request.json();

        if (!body.message) {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400 }
            );
        }

        const message = await ticketRepo.addMessage({
            ticketId: params.id,
            message: body.message,
            senderType: 'CUSTOMER',
            senderName: pelanggan.nama,
            attachments: body.attachments,
        });

        // If ticket was WAITING_CUSTOMER, change to IN_PROGRESS
        if (ticket.status === 'WAITING_CUSTOMER') {
            await ticketRepo.updateStatus(params.id, 'IN_PROGRESS');
        }

        return NextResponse.json({
            success: true,
            data: message,
            message: 'Reply sent successfully',
        }, { status: 201 });
    } catch (error) {
        console.error('Error adding message:', error);
        return NextResponse.json(
            { error: 'Failed to send reply' },
            { status: 500 }
        );
    }
}
