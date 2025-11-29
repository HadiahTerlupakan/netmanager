import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { TicketRepository } from '@/lib/repositories/TicketRepository';
import { verifyAuth } from '@/lib/auth';

const prisma = new PrismaClient();
const ticketRepo = new TicketRepository(prisma);

// GET /api/admin/helpdesk/tickets - List all tickets with filtering
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user || user.role === 'USER') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const status = searchParams.get('status');
        const priority = searchParams.get('priority');
        const categoryId = searchParams.get('categoryId');
        const assignedToId = searchParams.get('assignedToId');
        const search = searchParams.get('search');
        const unassignedOnly = searchParams.get('unassignedOnly') === 'true';

        const filters: any = {};

        if (status) {
            filters.status = status.includes(',') ? status.split(',') : status;
        }
        if (priority) {
            filters.priority = priority.includes(',') ? priority.split(',') : priority;
        }
        if (categoryId) filters.categoryId = categoryId;
        if (assignedToId) filters.assignedToId = assignedToId;
        if (search) filters.search = search;
        if (unassignedOnly) filters.unassignedOnly = true;

        const result = await ticketRepo.findAll(filters, page, limit);

        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error('Error fetching tickets:', error);
        return NextResponse.json(
            { error: 'Failed to fetch tickets' },
            { status: 500 }
        );
    }
}

// POST /api/admin/helpdesk/tickets - Create ticket (atas nama customer)
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user || user.role === 'USER') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();

        if (!body.pelangganId || !body.subject || !body.description) {
            return NextResponse.json(
                { error: 'Pelanggan ID, subject, and description are required' },
                { status: 400 }
            );
        }

        const ticket = await ticketRepo.create({
            pelangganId: body.pelangganId,
            categoryId: body.categoryId,
            subject: body.subject,
            description: body.description,
            priority: body.priority || 'NORMAL',
        });

        // If assignedToId is provided, assign immediately
        if (body.assignedToId) {
            await ticketRepo.assignToUser(ticket.id, body.assignedToId);
        }

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
