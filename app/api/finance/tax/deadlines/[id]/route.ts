import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'

interface RouteContext {
    params: Promise<{ id: string }>
}

export async function GET(
    request: NextRequest,
    context: RouteContext
) {
    try {
        const { id } = await context.params

        const deadline = await prisma.taxFilingDeadline.findUnique({
            where: { id },
        });

        if (!deadline) {
            return NextResponse.json({ error: 'Deadline not found' }, { status: 404 });
        }

        return NextResponse.json(deadline);
    } catch (error: any) {
        console.error('Error fetching deadline:', error);
        return NextResponse.json(
            { error: 'Failed to fetch deadline', details: error.message },
            { status: 500 }
        );
    }
}

// PUT /api/finance/tax/deadlines/[id] - Update deadline
export async function PUT(
    request: NextRequest,
    context: RouteContext
) {
    try {
        const { id } = await context.params
        const body = await request.json();
        const { status, filedAt, filedBy, notes } = body;

        const updated = await prisma.taxFilingDeadline.update({
            where: { id },
            data: {
                ...(status && { status }),
                ...(filedAt && { filedAt: new Date(filedAt) }),
                ...(filedBy && { filedBy }),
                ...(notes !== undefined && { notes }),
            },
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error('Error updating deadline:', error);
        return NextResponse.json(
            { error: 'Failed to update deadline', details: error.message },
            { status: 500 }
        );
    }
}

// PATCH /api/finance/tax/deadlines/[id]/file - Mark as filed
export async function PATCH(
    request: NextRequest,
    context: RouteContext
) {
    try {
        const { id } = await context.params
        const body = await request.json();
        const { filedBy, notes } = body;

        const updated = await prisma.taxFilingDeadline.update({
            where: { id },
            data: {
                status: 'FILED',
                filedAt: new Date(),
                filedBy,
                notes,
            },
        });

        return NextResponse.json(updated);
    } catch (error: any) {
        console.error('Error marking deadline as filed:', error);
        return NextResponse.json(
            { error: 'Failed to mark deadline as filed', details: error.message },
            { status: 500 }
        );
    }
}
