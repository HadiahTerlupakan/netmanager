
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/modules/database';
import { requireAuth } from '@/lib/auth-helpers';

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAuth(request);
        // Verify admin role
        // if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const { id } = await params;
        const body = await request.json();
        const { title, content, target, isActive, isPinned, startDate, endDate } = body;

        const announcement = await prisma.announcement.update({
            where: { id },
            data: {
                title,
                content,
                target,
                isActive,
                isPinned,
                ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
                ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
            }
        });

        return NextResponse.json(announcement);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAuth(request);
        // Verify admin role
        // if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

        const { id } = await params;

        await prisma.announcement.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
