import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { TicketRepository } from '@/lib/repositories/TicketRepository';
import { verifyAuth } from '@/lib/auth';

const prisma = new PrismaClient();
const ticketRepo = new TicketRepository(prisma);

// GET /api/admin/helpdesk/stats - Get helpdesk statistics
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
        const categoryId = searchParams.get('categoryId');
        const assignedToId = searchParams.get('assignedToId');

        const filters: any = {};
        if (categoryId) filters.categoryId = categoryId;
        if (assignedToId) filters.assignedToId = assignedToId;

        const stats = await ticketRepo.getStatistics(filters);

        return NextResponse.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        return NextResponse.json(
            { error: 'Failed to fetch statistics' },
            { status: 500 }
        );
    }
}
