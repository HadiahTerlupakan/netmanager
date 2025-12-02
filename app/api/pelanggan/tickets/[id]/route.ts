import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TicketRepository } from '@/lib/repositories/TicketRepository';

const ticketRepo = new TicketRepository(prisma);

// GET /api/pelanggan/tickets/[id] - Get detail ticket
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const pelangganData = request.headers.get('pelanggan-data');

        if (!pelangganData) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { id } = await params;
        const pelanggan = JSON.parse(pelangganData);
        const ticket = await ticketRepo.findById(id);

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
        // Ensure messages array exists and filter properly
        if (ticket.messages && Array.isArray(ticket.messages)) {
            const originalCount = ticket.messages.length;
            
            // Log all messages for debugging
            console.log(`[Pelanggan Ticket Detail] Ticket ${id}: ${originalCount} total messages`);
            ticket.messages.forEach((msg, idx) => {
                console.log(`  Message ${idx + 1}: id=${msg.id}, senderType=${msg.senderType}, isInternal=${msg.isInternal} (type: ${typeof msg.isInternal}), createdAt=${msg.createdAt}, message=${msg.message?.substring(0, 50)}...`);
            });
            
            ticket.messages = ticket.messages.filter(msg => {
                // Show all CUSTOMER messages regardless of isInternal
                // Only filter out STAFF messages that are explicitly internal
                if (msg.senderType === 'CUSTOMER') {
                    return true; // Always show customer messages
                }
                // For STAFF messages, only show non-internal ones
                return msg.isInternal !== true && msg.isInternal !== 'true';
            });
            
            console.log(`[Pelanggan Ticket Detail] Ticket ${id}: After filtering, ${ticket.messages.length} messages shown`);
            
            // Sort by createdAt to ensure chronological order
            ticket.messages.sort((a, b) => {
                const dateA = new Date(a.createdAt).getTime();
                const dateB = new Date(b.createdAt).getTime();
                return dateA - dateB;
            });
        } else {
            ticket.messages = [];
            console.log(`[Pelanggan Ticket Detail] Ticket ${id}: No messages array found`);
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
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const pelangganData = request.headers.get('pelanggan-data');

        if (!pelangganData) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { id } = await params;
        const pelanggan = JSON.parse(pelangganData);
        const ticket = await ticketRepo.findById(id);

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
            ticketId: id,
            message: body.message,
            senderType: 'CUSTOMER',
            senderName: pelanggan.nama,
            isInternal: false, // Explicitly set to false for customer messages
            attachments: body.attachments,
        });
        
        console.log(`[Pelanggan Ticket Detail] Message created: id=${message.id}, senderType=${message.senderType}, isInternal=${message.isInternal}`);

        // If ticket was WAITING_CUSTOMER, change to IN_PROGRESS
        if (ticket.status === 'WAITING_CUSTOMER') {
            await ticketRepo.updateStatus(id, 'IN_PROGRESS');
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
