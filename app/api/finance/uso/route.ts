import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { USORepository } from '@/lib/repositories/USORepository';

const prisma = new PrismaClient();
const usoRepo = new USORepository(prisma);

// GET /api/finance/uso - List USO contributions
export async function GET(request: NextRequest) {
    try {
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
        const body = await request.json();
        const { quarter, year, totalRevenue, usoRate, notes, createdBy } = body;

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
            createdBy,
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
