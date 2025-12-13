import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'
import { USORepository } from '@/lib/repositories/USORepository';
import FinanceAuthService from '@/lib/services/FinanceAuthService';

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
        // Authentication check
        const authResult = await FinanceAuthService.authenticate(request);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
        }

        const { id } = await context.params
        const filedBy = authResult.user?.name || authResult.user?.email;

        const contribution = await usoRepo.markAsFiled(id, filedBy || 'Unknown');

        return NextResponse.json(contribution);
    } catch (error: any) {
        console.error('[USO API] Error marking USO as filed:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to mark USO as filed' },
            { status: 500 }
        );
    }
}
