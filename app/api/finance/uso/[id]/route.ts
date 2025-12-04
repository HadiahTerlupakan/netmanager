import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'
import { USORepository } from '@/lib/repositories/USORepository';

const usoRepo = new USORepository(prisma);

interface RouteContext {
    params: Promise<{ id: string }>
}

// GET /api/finance/uso/[id] - Get USO detail
export async function GET(
    request: NextRequest,
    context: RouteContext
) {
    try {
        const { id } = await context.params
        const contribution = await usoRepo.findById(id);

        if (!contribution) {
            return NextResponse.json(
                { error: 'USO contribution not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(contribution);
    } catch (error) {
        console.error('[USO API] Error fetching USO detail:', error);
        return NextResponse.json(
            { error: 'Failed to fetch USO contribution' },
            { status: 500 }
        );
    }
}

// PUT /api/finance/uso/[id] - Update USO
export async function PUT(
    request: NextRequest,
    context: RouteContext
) {
    try {
        const { id } = await context.params
        const body = await request.json();

        const contribution = await usoRepo.update(id, body);

        return NextResponse.json(contribution);
    } catch (error: any) {
        console.error('[USO API] Error updating USO:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to update USO contribution' },
            { status: 500 }
        );
    }
}

// DELETE /api/finance/uso/[id] - Delete USO
export async function DELETE(
    request: NextRequest,
    context: RouteContext
) {
    try {
        const { id } = await context.params
        await usoRepo.delete(id);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[USO API] Error deleting USO:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to delete USO contribution' },
            { status: 500 }
        );
    }
}
