import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'

import FinanceAuthService from '@/lib/services/FinanceAuthService'
const prisma = new PrismaClient()

interface RouteContext {
  params: Promise<{ id: string }>
}

// DELETE - Hapus transaksi bank
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
        // Authentication check
        const authResult = await FinanceAuthService.authenticate(request);
        if (!authResult.success) {
            return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
        }

    const session = await getServerSession(authConfig)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    // Ambil data transaksi untuk mendapatkan informasi
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        bankAccount: true
      }
    })

    if (!transaction) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan' }, { status: 404 })
    }

    // Hitung kembali saldo rekening bank
    let newSaldo: bigint
    if (transaction.tipeTransaksi === 'DEBIT') {
      // Jika DEBIT, kurangi dari saldo saat ini
      newSaldo = BigInt(transaction.bankAccount.saldoSaatIni) - BigInt(transaction.jumlah)
    } else {
      // Jika KREDIT, tambahkan ke saldo saat ini
      newSaldo = BigInt(transaction.bankAccount.saldoSaatIni) + BigInt(transaction.jumlah)
    }

    // Hapus transaksi
    await prisma.transaction.delete({
      where: { id }
    })

    // Update saldo rekening bank
    await prisma.bankAccount.update({
      where: { id: transaction.bankAccountId },
      data: {
        saldoSaatIni: newSaldo,
        updatedBy: session.user.id,
      }
    })

    return NextResponse.json({
      message: 'Berhasil menghapus transaksi bank'
    })
  } catch (error) {
    console.error('Error deleting bank transaction:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghapus transaksi bank' },
      { status: 500 }
    )
  }
}
