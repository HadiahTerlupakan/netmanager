import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'
import { USORepository } from '@/lib/repositories/USORepository';
import { PengeluaranRepository } from '@/lib/repositories/PengeluaranRepository';

const usoRepo = new USORepository(prisma);
const pengeluaranRepo = new PengeluaranRepository(prisma);

interface RouteContext {
    params: Promise<{ id: string }>
}

// PATCH /api/finance/uso/[id]/pay - Mark as paid & create expense
export async function PATCH(
    request: NextRequest,
    context: RouteContext
) {
    try {
        const { id } = await context.params
        const body = await request.json();
        const { paidBy, paymentDate } = body;

        if (!paidBy) {
            return NextResponse.json(
                { error: 'paidBy is required' },
                { status: 400 }
            );
        }

        // Get USO contribution
        const uso = await usoRepo.findById(id);
        if (!uso) {
            return NextResponse.json(
                { error: 'USO contribution not found' },
                { status: 404 }
            );
        }

        // Create Pengeluaran (expense) for USO payment
        const paidDate = paymentDate ? new Date(paymentDate) : new Date();

        const expense = await pengeluaranRepo.create({
            tanggal: paidDate,
            tipePengeluaran: 'OPEX' as const,
            kategori: 'USO_CONTRIBUTION',
            deskripsi: `BHP USO Q${uso.quarter} ${uso.year} - Biaya Hak Penyelenggaraan & Kewajiban Pelayanan Universal 1.25%`,
            jumlah: parseFloat(uso.usoAmount),
            metodeBayar: 'TRANSFER',
            catatan: `Auto-created from USO contribution ${uso.id}. Total revenue: Rp ${parseFloat(uso.totalRevenue).toLocaleString('id-ID')}`,
            createdBy: paidBy,
        });

        // Mark USO as paid with expense reference
        const contribution = await usoRepo.markAsPaid(
            id,
            paidBy,
            expense.id
        );

        return NextResponse.json({
            contribution,
            expense: {
                id: expense.id,
                amount: uso.usoAmount,
            },
        });
    } catch (error: any) {
        console.error('[USO API] Error marking USO as paid:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to mark USO as paid' },
            { status: 500 }
        );
    }
}
