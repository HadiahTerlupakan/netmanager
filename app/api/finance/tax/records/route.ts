import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'
import { TaxRepository } from '@/lib/repositories/TaxRepository';

const taxRepo = new TaxRepository(prisma);

// GET /api/finance/tax/records - List tax records with filters
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;

        const filters = {
            taxType: searchParams.get('taxType') || undefined,
            period: searchParams.get('taxPeriod') ? parseInt(searchParams.get('taxPeriod')!) : undefined,
            year: searchParams.get('taxYear') ? parseInt(searchParams.get('taxYear')!) : undefined,
            status: searchParams.get('status') || undefined,
            relatedEntityType: searchParams.get('relatedEntityType') || undefined,
            page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
            limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
        };

        const result = await taxRepo.getTaxRecords(filters);

        // Convert BigInt to string for JSON serialization
        const serializedData = {
            ...result,
            data: result.data.map((record) => ({
                ...record,
                taxableAmount: record.taxableAmount.toString(),
                taxAmount: record.taxAmount.toString(),
            })),
        };

        return NextResponse.json(serializedData);
    } catch (error: any) {
        console.error('Error fetching tax records:', error);
        return NextResponse.json(
            { error: 'Failed to fetch tax records', details: error.message },
            { status: 500 }
        );
    }
}

// POST /api/finance/tax/records - Create new tax record
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Validate required fields
        if (!body.taxType || !body.taxPeriod || !body.taxYear || !body.taxableAmount) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        // Calculate tax if not provided
        let taxAmount = body.taxAmount;
        let taxRate = body.taxRate;

        if (!taxAmount || !taxRate) {
            const calculation = await taxRepo.calculateTax(body.taxType, BigInt(body.taxableAmount));
            taxAmount = calculation.taxAmount.toString();
            taxRate = calculation.taxRate;
        }

        const taxRecord = await taxRepo.createTaxRecord({
            taxType: body.taxType,
            taxPeriod: body.taxPeriod,
            taxYear: body.taxYear,
            taxableAmount: BigInt(body.taxableAmount),
            taxAmount: BigInt(taxAmount),
            taxRate: taxRate,
            reference: body.reference,
            relatedEntityType: body.relatedEntityType,
            relatedEntityId: body.relatedEntityId,
            notes: body.notes,
            createdBy: body.createdBy,
        });

        // Convert BigInt to string
        const serialized = {
            ...taxRecord,
            taxableAmount: taxRecord.taxableAmount.toString(),
            taxAmount: taxRecord.taxAmount.toString(),
        };

        return NextResponse.json(serialized, { status: 201 });
    } catch (error: any) {
        console.error('Error creating tax record:', error);
        return NextResponse.json(
            { error: 'Failed to create tax record', details: error.message },
            { status: 500 }
        );
    }
}
