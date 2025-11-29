import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { TicketRepository } from '@/lib/repositories/TicketRepository';
import { verifyAuth } from '@/lib/auth';

const prisma = new PrismaClient();
const ticketRepo = new TicketRepository(prisma);

// PATCH /api/admin/helpdesk/categories/[id] - Update category
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = await verifyAuth(request);
        if (!user || user.role === 'USER') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const category = await ticketRepo.updateCategory(params.id, body);

        return NextResponse.json({
            success: true,
            data: category,
            message: 'Category updated successfully',
        });
    } catch (error) {
        console.error('Error updating category:', error);
        return NextResponse.json(
            { error: 'Failed to update category' },
            { status: 500 }
        );
    }
}

// DELETE /api/admin/helpdesk/categories/[id] - Delete (soft delete) category
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const user = await verifyAuth(request);
        if (!user || user.role === 'USER') {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        await ticketRepo.deleteCategory(params.id);

        return NextResponse.json({
            success: true,
            message: 'Category deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting category:', error);
        return NextResponse.json(
            { error: 'Failed to delete category' },
            { status: 500 }
        );
    }
}
