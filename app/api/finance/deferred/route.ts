import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'
import { DeferredRevenueRepository } from '@/lib/repositories/DeferredRevenueRepository';

import FinanceAuthService from '@/lib/services/FinanceAuthService'
const deferredRepo = new DeferredRevenueRepository(prisma);

// GET /api/finance/deferred - List deferred revenues
export async function GET(request: NextRequest) {
    try {
        // Authentication check
        const authResult = await FinanceAuthService.authenticate(request);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const status = searchParams.get('status');
        const customerId = searchParams.get('customerId');
        const tagihanId = searchParams.get('tagihanId');

        const filters: any = {};
        if (status) filters.status = status;
        if (customerId) filters.customerId = customerId;
        if (tagihanId) filters.tagihanId = tagihanId;

        const deferrals = await deferredRepo.findAll(filters);

        return NextResponse.json(deferrals);
    } catch (error) {
        console.error('[Deferred API] Error fetching deferrals:', error);
        return NextResponse.json(
            { error: 'Failed to fetch deferred revenues' },
            { status: 500 }
        );
    }
}

// POST /api/finance/deferred - Create deferred revenue
export async function POST(request: NextRequest) {
    try {
        // Authentication check
        const authResult = await FinanceAuthService.authenticate(request);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const {
            tagihanId,
            customerId,
            totalAmount,
            periodMonths,
            startDate,
            endDate,
            description,
            notes,
            createdBy,
        } = body;

        if (!totalAmount || !periodMonths) {
            return NextResponse.json(
                { error: 'totalAmount and periodMonths are required' },
                { status: 400 }
            );
        }

        const deferral = await deferredRepo.create({
            tagihanId,
            customerId,
            totalAmount: BigInt(totalAmount),
            periodMonths,
            startDate: startDate ? new Date(startDate) : new Date(),
            endDate: endDate ? new Date(endDate) : undefined,
            description,
            notes,
            createdBy,
        });

        return NextResponse.json(deferral, { status: 201 });
    } catch (error: any) {
        console.error('[Deferred API] Error creating deferral:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create deferred revenue' },
            { status: 500 }
        );
    }
}
