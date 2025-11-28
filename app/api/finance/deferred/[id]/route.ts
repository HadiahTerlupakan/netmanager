import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { DeferredRevenueRepository } from '@/lib/repositories/DeferredRevenueRepository';

const prisma = new PrismaClient();
const deferredRepo = new DeferredRevenueRepository(prisma);

// GET /api/finance/deferred/[id] - Get detail
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const deferral = await deferredRepo.findById(params.id);

        if (!deferral) {
            return NextResponse.json(
                { error: 'Deferred revenue not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(deferral);
    } catch (error) {
        console.error('[Deferred API] Error fetching deferral:', error);
        return NextResponse.json(
            { error: 'Failed to fetch deferred revenue' },
            { status: 500 }
        );
    }
}

// PUT /api/finance/deferred/[id] - Update
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const body = await request.json();

        const deferral = await deferredRepo.update(params.id, body);

        return NextResponse.json(deferral);
    } catch (error: any) {
        console.error('[Deferred API] Error updating deferral:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to update deferred revenue' },
            { status: 500 }
        );
    }
}

// DELETE /api/finance/deferred/[id] - Cancel
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const deferral = await deferredRepo.cancel(params.id);

        return NextResponse.json(deferral);
    } catch (error: any) {
        console.error('[Deferred API] Error cancelling deferral:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to cancel deferred revenue' },
            { status: 500 }
        );
    }
}
