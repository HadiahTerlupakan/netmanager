import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DeferredRevenueRepository } from '@/lib/repositories/DeferredRevenueRepository';

const prisma = new PrismaClient();
const deferredRepo = new DeferredRevenueRepository(prisma);

// GET /api/finance/deferred/schedule/[id] - Get recognition schedule
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const schedule = await deferredRepo.getRecognitionSchedule(params.id);

        return NextResponse.json({
            deferredId: params.id,
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
