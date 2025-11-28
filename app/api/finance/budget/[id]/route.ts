import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { BudgetRepository } from '@/lib/repositories/BudgetRepository';

const prisma = new PrismaClient();
const budgetRepo = new BudgetRepository(prisma);

// GET /api/finance/budget/[id] - Get single budget
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const budget = await budgetRepo.findById(params.id);

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
    { params }: { params: { id: string } }
) {
    try {
        const body = await request.json();

        const updated = await budgetRepo.update(params.id, body);

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
    { params }: { params: { id: string } }
) {
    try {
        await budgetRepo.delete(params.id);
        return NextResponse.json({ success: true, message: 'Budget deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting budget:', error);
        return NextResponse.json(
            { error: 'Failed to delete budget', details: error.message },
            { status: 500 }
        );
    }
}
