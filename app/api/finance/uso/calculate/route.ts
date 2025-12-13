import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'
import { USORepository } from '@/lib/repositories/USORepository';
import FinanceAuthService from '@/lib/services/FinanceAuthService';

const usoRepo = new USORepository(prisma);

// POST /api/finance/uso/calculate - Calculate USO for quarter
export async function POST(request: NextRequest) {
    try {
        // Authentication check
        const authResult = await FinanceAuthService.authenticate(request);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { quarter, year } = body;

        if (!quarter || !year) {
            return NextResponse.json(
                { error: 'Quarter and year are required' },
                { status: 400 }
            );
        }

        if (quarter < 1 || quarter > 4) {
            return NextResponse.json(
                { error: 'Quarter must be between 1 and 4' },
                { status: 400 }
            );
        }

        const contribution = await usoRepo.calculateForQuarter(
            quarter,
            year,
            authResult.user?.name || authResult.user?.email
        );

        return NextResponse.json(contribution);
    } catch (error: any) {
        console.error('[USO API] Error calculating USO:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to calculate USO' },
            { status: 500 }
        );
    }
}
