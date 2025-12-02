import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined;
        const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear();
        const status = searchParams.get('status') || undefined;
        const taxType = searchParams.get('taxType') || undefined;

        const where: any = { year };

        if (month) {
            where.period = month;
        }

        if (status) {
            where.status = status;
        }

        if (taxType) {
            where.taxType = taxType;
        }

        const deadlines = await prisma.taxFilingDeadline.findMany({
            where,
            orderBy: [
                { deadline: 'asc' },
            ],
        });

        return NextResponse.json(deadlines);
    } catch (error: any) {
        console.error('Error fetching tax deadlines:', error);
        return NextResponse.json(
            { error: 'Failed to fetch tax deadlines', details: error.message },
            { status: 500 }
        );
    }
}

// POST /api/finance/tax/deadlines - Create new tax filing deadline
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { taxType, period, year, deadline, notes } = body;

        if (!taxType || !period || !year || !deadline) {
            return NextResponse.json(
                { error: 'Missing required fields: taxType, period, year, deadline' },
                { status: 400 }
            );
        }

        const deadlineRecord = await prisma.taxFilingDeadline.create({
            data: {
                taxType,
                period,
                year,
                deadline: new Date(deadline),
                notes,
            },
        });

        return NextResponse.json(deadlineRecord);
    } catch (error: any) {
        console.error('Error creating tax deadline:', error);
        return NextResponse.json(
            { error: 'Failed to create tax deadline', details: error.message },
            { status: 500 }
        );
    }
}
