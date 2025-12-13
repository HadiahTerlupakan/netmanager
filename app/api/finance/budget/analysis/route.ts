import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { BudgetRepository } from '@/lib/repositories/BudgetRepository';

import FinanceAuthService from '@/lib/services/FinanceAuthService'
const budgetRepo = new BudgetRepository(prisma);

// GET /api/finance/budget/analysis
export async function GET(request: NextRequest) {
    try {
        // Authentication check
        const authResult = await FinanceAuthService.authenticate(request);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;

        const month = searchParams.get('month')
            ? parseInt(searchParams.get('month')!)
            : new Date().getMonth() + 1;
        const year = searchParams.get('year')
            ? parseInt(searchParams.get('year')!)
            : new Date().getFullYear();

        const analysis = await budgetRepo.getBudgetAnalysis(month, year);

        // Serialize BigInt fields
        const serialized = {
            ...analysis,
            totalBudget: analysis.totalBudget.toString(),
            totalActual: analysis.totalActual.toString(),
            totalVariance: analysis.totalVariance.toString(),
            budgetsByCategory: analysis.budgetsByCategory.map((item) => ({
                ...item,
                budget: {
                    ...item.budget,
                    budgetAmount: item.budget.budgetAmount.toString(),
                    actualAmount: item.budget.actualAmount.toString(),
                    variance: item.budget.variance.toString(),
                },
            })),
        };

        return NextResponse.json(serialized);
    } catch (error: any) {
        console.error('Error generating budget analysis:', error);
        return NextResponse.json(
            { error: 'Failed to generate budget analysis', details: error.message },
            { status: 500 }
        );
    }
}
