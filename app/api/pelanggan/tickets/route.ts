import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { TicketRepository } from '@/lib/repositories/TicketRepository';

const prisma = new PrismaClient();
const ticketRepo = new TicketRepository(prisma);

// GET /api/pelanggan/tickets - List tickets untuk customer yang login
export async function GET(request: NextRequest) {
    try {
        // Get pelanggan from auth (assuming we have pelanggan authentication)
        const pelangganData = request.headers.get('pelanggan-data');

        if (!pelangganData) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const pelanggan = JSON.parse(pelangganData);
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');

        const tickets = await ticketRepo.findByPelangganId(
            pelanggan.id,
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
        const pelangganData = request.headers.get('pelanggan-data');

        if (!pelangganData) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const pelanggan = JSON.parse(pelangganData);
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
            pelangganId: pelanggan.id,
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
            senderName: pelanggan.nama,
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
