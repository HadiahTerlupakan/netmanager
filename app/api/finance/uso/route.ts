import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'
import { USORepository } from '@/lib/repositories/USORepository';
import FinanceAuthService from '@/lib/services/FinanceAuthService';

const usoRepo = new USORepository(prisma);

// GET /api/finance/uso - List USO contributions
export async function GET(request: NextRequest) {
    try {
        // Authentication check
        const authResult = await FinanceAuthService.authenticate(request);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const year = searchParams.get('year');
        const status = searchParams.get('status');
        const quarter = searchParams.get('quarter');

        const filters: any = {};
        if (year) filters.year = parseInt(year);
        if (status) filters.status = status;
        if (quarter) filters.quarter = parseInt(quarter);

        const contributions = await usoRepo.findAll(filters);

        return NextResponse.json(contributions);
    } catch (error) {
        console.error('[USO API] Error fetching USO contributions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch USO contributions' },
            { status: 500 }
        );
    }
}

// POST /api/finance/uso - Create USO contribution
export async function POST(request: NextRequest) {
    try {
        // Authentication check
        const authResult = await FinanceAuthService.authenticate(request);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { quarter, year, totalRevenue, usoRate, notes } = body;

        if (!quarter || !year) {
            return NextResponse.json(
                { error: 'Quarter and year are required' },
                { status: 400 }
            );
        }

        const contribution = await usoRepo.create({
            quarter,
            year,
            totalRevenue: totalRevenue ? BigInt(totalRevenue) : undefined,
            usoRate,
            notes,
            createdBy: authResult.user?.name || authResult.user?.email,
        });

        return NextResponse.json(contribution, { status: 201 });
    } catch (error: any) {
        console.error('[USO API] Error creating USO contribution:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create USO contribution' },
            { status: 500 }
        );
    }
}
