import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'
import { BudgetRepository } from '@/lib/repositories/BudgetRepository';

import FinanceAuthService from '@/lib/services/FinanceAuthService'
const budgetRepo = new BudgetRepository(prisma);

// GET /api/finance/budget/categories
export async function GET(request: NextRequest) {
    try {
        // Authentication check
        const authResult = await FinanceAuthService.authenticate(request);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const type = searchParams.get('type') || undefined; // OPEX or CAPEX
        const includeInactive = searchParams.get('includeInactive') === 'true';

        const categories = await budgetRepo.getCategories(type, includeInactive);

        return NextResponse.json(categories);
    } catch (error: any) {
        console.error('Error fetching budget categories:', error);
        return NextResponse.json(
            { error: 'Failed to fetch budget categories', details: error.message },
            { status: 500 }
        );
    }
}
