import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'
import { TaxRepository } from '@/lib/repositories/TaxRepository';

const taxRepo = new TaxRepository(prisma);

interface RouteContext {
    params: Promise<{ id: string }>
}

// GET /api/finance/tax/records/[id]
export async function GET(
    request: NextRequest,
    context: RouteContext
) {
    try {
        const { id } = await context.params
        const taxRecord = await taxRepo.getTaxRecordById(id);

        if (!taxRecord) {
            return NextResponse.json({ error: 'Tax record not found' }, { status: 404 });
        }

        const serialized = {
            ...taxRecord,
            taxableAmount: taxRecord.taxableAmount.toString(),
            taxAmount: taxRecord.taxAmount.toString(),
        };

        return NextResponse.json(serialized);
    } catch (error: any) {
        console.error('Error fetching tax record:', error);
        return NextResponse.json(
            { error: 'Failed to fetch tax record', details: error.message },
            { status: 500 }
        );
    }
}

// PUT /api/finance/tax/records/[id]
export async function PUT(
    request: NextRequest,
    context: RouteContext
) {
    try {
        const { id } = await context.params
        const body = await request.json();

        const updateData: any = { ...body };

        // Convert BigInt fields if present
        if (body.taxableAmount) {
            updateData.taxableAmount = BigInt(body.taxableAmount);
        }
        if (body.taxAmount) {
            updateData.taxAmount = BigInt(body.taxAmount);
        }

        const taxRecord = await taxRepo.updateTaxRecord(id, updateData);

        const serialized = {
            ...taxRecord,
            taxableAmount: taxRecord.taxableAmount.toString(),
            taxAmount: taxRecord.taxAmount.toString(),
        };

        return NextResponse.json(serialized);
    } catch (error: any) {
        console.error('Error updating tax record:', error);
        return NextResponse.json(
            { error: 'Failed to update tax record', details: error.message },
            { status: 500 }
        );
    }
}

// DELETE /api/finance/tax/records/[id]
export async function DELETE(
    request: NextRequest,
    context: RouteContext
) {
    try {
        const { id } = await context.params
        await taxRepo.deleteTaxRecord(id);
        return NextResponse.json({ message: 'Tax record deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting tax record:', error);
        return NextResponse.json(
            { error: 'Failed to delete tax record', details: error.message },
            { status: 500 }
        );
    }
}
