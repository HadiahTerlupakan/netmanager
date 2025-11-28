import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { TaxRepository } from '@/lib/repositories/TaxRepository';

const prisma = new PrismaClient();
const taxRepo = new TaxRepository(prisma);

// GET /api/finance/tax/records/[id]
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const taxRecord = await taxRepo.getTaxRecordById(params.id);

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
    { params }: { params: { id: string } }
) {
    try {
        const body = await request.json();

        const updateData: any = { ...body };

        // Convert BigInt fields if present
        if (body.taxableAmount) {
            updateData.taxableAmount = BigInt(body.taxableAmount);
        }
        if (body.taxAmount) {
            updateData.taxAmount = BigInt(body.taxAmount);
        }

        const taxRecord = await taxRepo.updateTaxRecord(params.id, updateData);

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
    { params }: { params: { id: string } }
) {
    try {
        await taxRepo.deleteTaxRecord(params.id);
        return NextResponse.json({ message: 'Tax record deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting tax record:', error);
        return NextResponse.json(
            { error: 'Failed to delete tax record', details: error.message },
            { status: 500 }
        );
    }
}
