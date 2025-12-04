import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'
import { USORepository } from '@/lib/repositories/USORepository';

const usoRepo = new USORepository(prisma);

interface RouteContext {
    params: Promise<{ id: string }>
}

// PATCH /api/finance/uso/[id]/file - Mark as filed
export async function PATCH(
    request: NextRequest,
    context: RouteContext
) {
    try {
        const { id } = await context.params
        const body = await request.json();
        const { filedBy } = body;

        if (!filedBy) {
            return NextResponse.json(
                { error: 'filedBy is required' },
                { status: 400 }
            );
        }

        const contribution = await usoRepo.markAsFiled(id, filedBy);

        return NextResponse.json(contribution);
    } catch (error: any) {
        console.error('[USO API] Error marking USO as filed:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to mark USO as filed' },
            { status: 500 }
        );
    }
}
