import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { TaxRepository } from '@/lib/repositories/TaxRepository';

const prisma = new PrismaClient();
const taxRepo = new TaxRepository(prisma);

// GET /api/finance/tax/reports/ppn
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;

        const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : new Date().getMonth() + 1;
        const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear();

        const report = await taxRepo.getPPNReport(month, year);

        // Serialize BigInt fields
        const serialized = {
            ...report,
            ppnIn: report.ppnIn.toString(),
            ppnOut: report.ppnOut.toString(),
            netPPN: report.netPPN.toString(),
            ppnInRecords: report.ppnInRecords.map((r) => ({
                ...r,
                taxableAmount: r.taxableAmount.toString(),
                taxAmount: r.taxAmount.toString(),
            })),
            ppnOutRecords: report.ppnOutRecords.map((r) => ({
                ...r,
                taxableAmount: r.taxableAmount.toString(),
                taxAmount: r.taxAmount.toString(),
            })),
        };

        return NextResponse.json(serialized);
    } catch (error: any) {
        console.error('Error generating PPN report:', error);
        return NextResponse.json(
            { error: 'Failed to generate PPN report', details: error.message },
            { status: 500 }
        );
    }
}
