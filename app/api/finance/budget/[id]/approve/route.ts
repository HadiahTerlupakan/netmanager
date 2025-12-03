import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


// GET /api/finance/budget/[id]/approve - Approve budget
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const body = await request.json();
        const { approvedBy, notes } = body;

        if (!approvedBy) {
            return NextResponse.json(
                { error: 'approvedBy is required' },
                { status: 400 }
            );
        }

        // Get current budget
        const budget = await prisma.budget.findUnique({
            where: { id: params.id },
        });

        if (!budget) {
            return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
        }

        // Check if already approved
        if (budget.status === 'APPROVED') {
            return NextResponse.json(
                { error: 'Budget already approved' },
                { status: 400 }
            );
        }

        // Update budget status to APPROVED
        const updated = await prisma.budget.update({
            where: { id: params.id },
            data: {
                status: 'APPROVED',
                approvedBy,
                approvedAt: new Date(),
                ...(notes && { notes }),
            },
        });

        // Serialize BigInt
        const serialized = {
            ...updated,
            budgetAmount: updated.budgetAmount.toString(),
            actualAmount: updated.actualAmount.toString(),
            variance: updated.variance.toString(),
        };

        return NextResponse.json(serialized);
    } catch (error: any) {
        console.error('Error approving budget:', error);
        return NextResponse.json(
            { error: 'Failed to approve budget', details: error.message },
            { status: 500 }
        );
    }
}
