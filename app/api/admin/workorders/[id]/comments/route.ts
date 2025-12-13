import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/lib/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';

const workOrderRepo = new WorkOrderRepository(prisma);

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { message } = body;

        if (!message) {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400 }
            );
        }

        const comment = await workOrderRepo.addComment(id, message, user.id);

        return NextResponse.json({
            success: true,
            data: comment,
            message: 'Comment added successfully',
        }, { status: 201 });
    } catch (error) {
        console.error('Error adding comment:', error);
        return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 });
    }
}
