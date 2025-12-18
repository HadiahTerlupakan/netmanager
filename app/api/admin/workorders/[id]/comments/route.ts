import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';
import { socketEmitter } from '@/lib/websocket/emitter';

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

        // Emit WebSocket event for real-time Activity Timeline
        socketEmitter.workOrderActivity(id, {
            id: comment.id,
            type: 'comment',
            message: comment.message,
            updateType: 'COMMENT',
            createdAt: comment.createdAt.toISOString(),
            createdBy: user ? {
                id: user.id,
                name: user.name || undefined,
            } : null,
        });

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
