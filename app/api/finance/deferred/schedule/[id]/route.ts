import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DeferredRevenueRepository } from '@/lib/repositories/DeferredRevenueRepository';

const deferredRepo = new DeferredRevenueRepository(prisma);

interface RouteContext {
    params: Promise<{ id: string }>
}

// GET /api/finance/deferred/schedule/[id] - Get recognition schedule
export async function GET(
    request: NextRequest,
    context: RouteContext
) {
    try {
        const { id } = await context.params
        const schedule = await deferredRepo.getRecognitionSchedule(id);

        return NextResponse.json({
            deferredId: id,
            schedule,
        });
    } catch (error: any) {
        console.error('[Deferred API] Error fetching schedule:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch recognition schedule' },
            { status: 500 }
        );
    }
}
