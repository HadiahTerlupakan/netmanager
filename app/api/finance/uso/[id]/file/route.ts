import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { USORepository } from '@/lib/repositories/USORepository';

const prisma = new PrismaClient();
const usoRepo = new USORepository(prisma);

// PATCH /api/finance/uso/[id]/file - Mark as filed
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const body = await request.json();
        const { filedBy } = body;

        if (!filedBy) {
            return NextResponse.json(
                { error: 'filedBy is required' },
                { status: 400 }
            );
        }

        const contribution = await usoRepo.markAsFiled(params.id, filedBy);

        return NextResponse.json(contribution);
    } catch (error: any) {
        console.error('[USO API] Error marking USO as filed:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to mark USO as filed' },
            { status: 500 }
        );
    }
}
