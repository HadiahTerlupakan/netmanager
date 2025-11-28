import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { TaxRepository } from '@/lib/repositories/TaxRepository';

const prisma = new PrismaClient();
const taxRepo = new TaxRepository(prisma);

// GET /api/finance/tax/reports/pph - Get PPh monthly report
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
        const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
        const type = searchParams.get('type') || 'PPH_21'; // PPH_21, PPH_23, PPH_4_2

        if (!['PPH_21', 'PPH_23', 'PPH_4_2'].includes(type)) {
            return NextResponse.json(
                { error: 'Invalid PPh type. Must be PPH_21, PPH_23, or PPH_4_2' },
                { status: 400 }
            );
        }

        const pphReport = await taxRepo.getPPHReport(month, year, type);

        // Serialize BigInt
        const serialized = {
            ...pphReport,
            pphRecords: pphReport.pphRecords.map((record: any) => ({
                ...record,
                taxableAmount: record.taxableAmount.toString(),
                taxAmount: record.taxAmount.toString(),
            })),
            totalTaxableAmount: pphReport.totalTaxableAmount.toString(),
            totalTaxAmount: pphReport.totalTaxAmount.toString(),
        };

        return NextResponse.json(serialized);
    } catch (error: any) {
        console.error('Error generating PPh report:', error);
        return NextResponse.json(
            { error: 'Failed to generate PPh report', details: error.message },
            { status: 500 }
        );
    }
}
