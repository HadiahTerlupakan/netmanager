import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { BudgetRepository } from '@/lib/repositories/BudgetRepository';

const prisma = new PrismaClient();
const budgetRepo = new BudgetRepository(prisma);

// GET /api/finance/budget - List budgets with filters
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;

        const filter = {
            year: searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined,
            month: searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined,
            categoryId: searchParams.get('categoryId') || undefined,
            department: searchParams.get('department') || undefined,
            status: searchParams.get('status') || undefined,
            type: searchParams.get('type') || undefined,
        };

        const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1;
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;

        const result = await budgetRepo.getBudgets(filter, page, limit);

        // Serialize BigInt fields
        const serializedData = {
            ...result,
            data: result.data.map((budget) => ({
                ...budget,
                budgetAmount: budget.budgetAmount.toString(),
                actualAmount: budget.actualAmount.toString(),
                variance: budget.variance.toString(),
            })),
        };

        return NextResponse.json(serializedData);
    } catch (error: any) {
        console.error('Error fetching budgets:', error);
        return NextResponse.json(
            { error: 'Failed to fetch budgets', details: error.message },
            { status: 500 }
        );
    }
}

// POST /api/finance/budget - Create new budget
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate required fields
        if (!body.year || !body.month || !body.categoryId || !body.budgetAmount) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const budget = await budgetRepo.createBudget({
            year: body.year,
            month: body.month,
            categoryId: body.categoryId,
            department: body.department,
            budgetAmount: BigInt(body.budgetAmount),
            notes: body.notes,
            createdBy: body.createdBy,
        });

        // Serialize BigInt
        const serialized = {
            ...budget,
            budgetAmount: budget.budgetAmount.toString(),
            actualAmount: budget.actualAmount.toString(),
            variance: budget.variance.toString(),
        };

        return NextResponse.json(serialized, { status: 201 });
    } catch (error: any) {
        console.error('Error creating budget:', error);
        return NextResponse.json(
            { error: 'Failed to create budget', details: error.message },
            { status: 500 }
        );
    }
}
