import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { BudgetRepository } from '@/lib/repositories/BudgetRepository';

const prisma = new PrismaClient();
const budgetRepo = new BudgetRepository(prisma);

// GET /api/finance/budget/categories
export async function GET(request: NextRequest) {
    try {
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
