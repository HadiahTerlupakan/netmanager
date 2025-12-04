import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { BudgetRepository } from '@/lib/repositories/BudgetRepository';

const budgetRepo = new BudgetRepository(prisma);

interface RouteContext {
    params: Promise<{ id: string }>
}

// GET /api/finance/budget/[id] - Get single budget
export async function GET(
    request: NextRequest,
    context: RouteContext
) {
    try {
        const { id } = await context.params
        const budget = await budgetRepo.getBudgetById(id);

        if (!budget) {
            return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
        }

        // Serialize BigInt
        const serialized = {
            ...budget,
            budgetAmount: budget.budgetAmount.toString(),
            actualAmount: budget.actualAmount.toString(),
            variance: budget.variance.toString(),
        };

        return NextResponse.json(serialized);
    } catch (error: any) {
        console.error('Error fetching budget:', error);
        return NextResponse.json(
            { error: 'Failed to fetch budget', details: error.message },
            { status: 500 }
        );
    }
}

// PUT /api/finance/budget/[id] - Update budget
export async function PUT(
    request: NextRequest,
    context: RouteContext
) {
    try {
        const { id } = await context.params
        const body = await request.json();

        const updated = await budgetRepo.updateBudget(id, body);

        // Serialize BigInt
        const serialized = {
            ...updated,
            budgetAmount: updated.budgetAmount.toString(),
            actualAmount: updated.actualAmount.toString(),
            variance: updated.variance.toString(),
        };

        return NextResponse.json(serialized);
    } catch (error: any) {
        console.error('Error updating budget:', error);
        return NextResponse.json(
            { error: 'Failed to update budget', details: error.message },
            { status: 500 }
        );
    }
}

// DELETE /api/finance/budget/[id] - Delete budget
export async function DELETE(
    request: NextRequest,
    context: RouteContext
) {
    try {
        const { id } = await context.params
        await budgetRepo.deleteBudget(id);
        return NextResponse.json({ success: true, message: 'Budget deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting budget:', error);
        return NextResponse.json(
            { error: 'Failed to delete budget', details: error.message },
            { status: 500 }
        );
    }
}
