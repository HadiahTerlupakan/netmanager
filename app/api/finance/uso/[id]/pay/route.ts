import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'
import { USORepository } from '@/lib/repositories/USORepository';
import { PengeluaranRepository } from '@/lib/repositories/PengeluaranRepository';
import FinanceAuthService from '@/lib/services/FinanceAuthService';

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
        // Authentication check
        const authResult = await FinanceAuthService.authenticate(request);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
        }

        const { id } = await context.params
        const body = await request.json();
        const { paymentDate } = body;
        const paidBy = authResult.user?.name || authResult.user?.email || 'Unknown';

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
