import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


// GET /api/finance/budget/forecast - Get cash flow forecast
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const months = parseInt(searchParams.get('months') || '3'); // Default 3 months
        const scenarioType = searchParams.get('scenarioType') || 'MOST_LIKELY';

        // Validate months
        if (![1, 3, 6, 12].includes(months)) {
            return NextResponse.json(
                { error: 'Invalid months. Must be 1, 3, 6, or 12' },
                { status: 400 }
            );
        }

        // Get existing forecasts
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + months);

        const forecasts = await prisma.cashFlowForecast.findMany({
            where: {
                forecastDate: {
                    gte: startDate,
                    lte: endDate,
                },
                scenarioType,
            },
            orderBy: { forecastDate: 'asc' },
        });

        // Serialize BigInt
        const serialized = forecasts.map((f) => ({
            ...f,
            projectedRevenue: f.projectedRevenue.toString(),
            projectedExpenses: f.projectedExpenses.toString(),
            projectedCashFlow: f.projectedCashFlow.toString(),
            projectedBalance: f.projectedBalance.toString(),
        }));

        return NextResponse.json(serialized);
    } catch (error: any) {
        console.error('Error fetching forecast:', error);
        return NextResponse.json(
            { error: 'Failed to fetch forecast', details: error.message },
            { status: 500 }
        );
    }
}

// POST /api/finance/budget/forecast - Create cash flow forecast
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            forecastDate,
            scenarioType = 'MOST_LIKELY',
            projectedRevenue,
            projectedExpenses,
            confidence = 0.7,
            assumptions,
            notes,
            createdBy,
        } = body;

        if (!forecastDate || !projectedRevenue || !projectedExpenses) {
            return NextResponse.json(
                { error: 'Missing required fields: forecastDate, projectedRevenue, projectedExpenses' },
                { status: 400 }
            );
        }

        // Calculate projected cash flow
        const projectedCashFlow = BigInt(projectedRevenue) - BigInt(projectedExpenses);

        // Get previous balance (simplified - in real app, calculate from actual data)
        const previousForecasts = await prisma.cashFlowForecast.findMany({
            where: {
                forecastDate: { lt: new Date(forecastDate) },
                scenarioType,
            },
            orderBy: { forecastDate: 'desc' },
            take: 1,
        });

        const previousBalance = previousForecasts.length > 0
            ? previousForecasts[0].projectedBalance
            : BigInt(0);

        const projectedBalance = previousBalance + projectedCashFlow;

        const forecast = await prisma.cashFlowForecast.create({
            data: {
                forecastDate: new Date(forecastDate),
                scenarioType,
                projectedRevenue: BigInt(projectedRevenue),
                projectedExpenses: BigInt(projectedExpenses),
                projectedCashFlow,
                projectedBalance,
                confidence,
                assumptions,
                notes,
                createdBy,
            },
        });

        // Serialize BigInt
        const serialized = {
            ...forecast,
            projectedRevenue: forecast.projectedRevenue.toString(),
            projectedExpenses: forecast.projectedExpenses.toString(),
            projectedCashFlow: forecast.projectedCashFlow.toString(),
            projectedBalance: forecast.projectedBalance.toString(),
        };

        return NextResponse.json(serialized);
    } catch (error: any) {
        console.error('Error creating forecast:', error);
        return NextResponse.json(
            { error: 'Failed to create forecast', details: error.message },
            { status: 500 }
        );
    }
}
