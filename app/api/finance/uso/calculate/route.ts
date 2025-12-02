import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'
import { USORepository } from '@/lib/repositories/USORepository';

const usoRepo = new USORepository(prisma);

// POST /api/finance/uso/calculate - Calculate USO for quarter
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { quarter, year, createdBy } = body;

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
            createdBy
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
