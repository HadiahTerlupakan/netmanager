import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'
import { TaxRepository } from '@/lib/repositories/TaxRepository';

import FinanceAuthService from '@/lib/services/FinanceAuthService'
const taxRepo = new TaxRepository(prisma);

// POST /api/finance/tax/calculate - Calculate tax amount
export async function POST(request: NextRequest) {
    try {
        // Authentication check
        const authResult = await FinanceAuthService.authenticate(request);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        if (!body.taxType || !body.taxableAmount) {
            return NextResponse.json(
                { error: 'Missing required fields: taxType and taxableAmount' },
                { status: 400 }
            );
        }

        const result = await taxRepo.calculateTax(body.taxType, BigInt(body.taxableAmount));

        // Serialize BigInt
        const serialized = {
            ...result,
            taxableAmount: result.taxableAmount.toString(),
            taxAmount: result.taxAmount.toString(),
        };

        return NextResponse.json(serialized);
    } catch (error: any) {
        console.error('Error calculating tax:', error);
        return NextResponse.json(
            { error: 'Failed to calculate tax', details: error.message },
            { status: 500 }
        );
    }
}
