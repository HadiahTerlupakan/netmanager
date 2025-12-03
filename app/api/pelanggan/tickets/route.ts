import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'
import { TicketRepository } from '@/lib/repositories/TicketRepository';
import { verifyPelangganAuth, getPelangganIdFromRequest } from '@/lib/middleware/pelanggan-auth';

const ticketRepo = new TicketRepository(prisma);

// GET /api/pelanggan/tickets - List tickets untuk customer yang login
export async function GET(request: NextRequest) {
    try {
        // Verify pelanggan authentication
        const authError = await verifyPelangganAuth(request);
        if (authError) return authError;

        // Get pelanggan ID from request headers
        const pelangganId = getPelangganIdFromRequest(request);
        if (!pelangganId) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');

        const tickets = await ticketRepo.findByPelangganId(
            pelangganId,
            status ? { status: status as any } : undefined
        );

        return NextResponse.json({
            success: true,
            data: tickets,
        });
    } catch (error) {
        console.error('Error fetching customer tickets:', error);
        return NextResponse.json(
            { error: 'Failed to fetch tickets' },
            { status: 500 }
        );
    }
}

// POST /api/pelanggan/tickets - Submit ticket baru
export async function POST(request: NextRequest) {
    try {
        // Verify pelanggan authentication
        const authError = await verifyPelangganAuth(request);
        if (authError) return authError;

        // Get pelanggan ID from request headers
        const pelangganId = getPelangganIdFromRequest(request);
        if (!pelangganId) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();

        // Validate required fields
        if (!body.subject || !body.description) {
            return NextResponse.json(
                { error: 'Subject and description are required' },
                { status: 400 }
            );
        }

        // Validate categoryId if provided
        if (body.categoryId) {
            const category = await prisma.ticketCategory.findUnique({
                where: { id: body.categoryId },
            });

            if (!category) {
                return NextResponse.json(
                    { error: 'Category tidak ditemukan' },
                    { status: 400 }
                );
            }

            if (!category.isActive) {
                return NextResponse.json(
                    { error: 'Category tidak aktif' },
                    { status: 400 }
                );
            }
        }

        const ticket = await ticketRepo.create({
            pelangganId: pelangganId,
            categoryId: body.categoryId || null,
            subject: body.subject,
            description: body.description,
            priority: body.priority || 'NORMAL',
            attachments: body.attachments,
        });

        // Create initial message (the description)
        await ticketRepo.addMessage({
            ticketId: ticket.id,
            message: body.description,
            senderType: 'CUSTOMER',
            senderName: 'Pelanggan', // Assuming 'Pelanggan' is the default name for customer messages
            isInternal: false, // Explicitly set to false for customer messages
        });

        return NextResponse.json({
            success: true,
            data: ticket,
            message: 'Ticket created successfully',
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating ticket:', error);
        return NextResponse.json(
            { error: 'Failed to create ticket' },
            { status: 500 }
        );
    }
}
