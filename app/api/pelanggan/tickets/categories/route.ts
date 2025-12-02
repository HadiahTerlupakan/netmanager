import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'
import { TicketRepository } from '@/lib/repositories/TicketRepository';

const ticketRepo = new TicketRepository(prisma);

// GET /api/pelanggan/tickets/categories - Get all active categories
export async function GET() {
    try {
        const categories = await ticketRepo.findAllCategories(true);

        return NextResponse.json({
            success: true,
            data: categories,
        });
    } catch (error) {
        console.error('Error fetching categories:', error);
        return NextResponse.json(
            { error: 'Failed to fetch categories' },
            { status: 500 }
        );
    }
}
