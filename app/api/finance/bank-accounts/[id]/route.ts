import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

import FinanceAuthService from '@/lib/services/FinanceAuthService'
const prisma = new PrismaClient()

// Schema validasi untuk update bank account
const updateBankAccountSchema = z.object({
  namaBank: z.string().min(1, 'Nama bank harus diisi').optional(),
  nomorRekening: z.string().min(1, 'Nomor rekening harus diisi').optional(),
  namaPemilik: z.string().min(1, 'Nama pemilik harus diisi').optional(),
  saldoAwal: z.string().transform((val) => BigInt(val)).optional(),
  mataUang: z.string().default('IDR').optional(),
  isActive: z.boolean().default(true).optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET - Mendapatkan rekening bank berdasarkan ID
export async function GET(
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

    const bankAccount = await prisma.bankAccount.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: {
            tanggal: 'desc'
          },
          take: 10 // Ambil 10 transaksi terakhir
        }
      }
    })

    if (!bankAccount) {
      return NextResponse.json({ error: 'Rekening bank tidak ditemukan' }, { status: 404 })
    }

    // Convert BigInt to string for JSON serialization
    const serializedAccount = {
      ...bankAccount,
      saldoAwal: bankAccount.saldoAwal.toString(),
      saldoSaatIni: bankAccount.saldoSaatIni.toString(),
      transactions: bankAccount.transactions.map(transaction => ({
        ...transaction,
        jumlah: transaction.jumlah.toString(),
        saldoSebelumnya: transaction.saldoSebelumnya.toString(),
        saldoSetelahnya: transaction.saldoSetelahnya.toString(),
      }))
    }

    return NextResponse.json({
      data: serializedAccount,
      message: 'Berhasil mengambil data rekening bank'
    })
  } catch (error) {
    console.error('Error fetching bank account:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data rekening bank' },
      { status: 500 }
    )
  }
}

// PUT - Update rekening bank
export async function PUT(
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
    const body = await request.json()
    const validatedData = updateBankAccountSchema.parse(body)

    const bankAccount = await prisma.bankAccount.update({
      where: { id },
      data: {
        ...validatedData,
        updatedBy: session.user.id,
      }
    })

    // Convert BigInt to string for JSON serialization
    const serializedAccount = {
      ...bankAccount,
      saldoAwal: bankAccount.saldoAwal.toString(),
      saldoSaatIni: bankAccount.saldoSaatIni.toString(),
    }

    return NextResponse.json({
      data: serializedAccount,
      message: 'Berhasil mengupdate rekening bank'
    })
  } catch (error) {
    console.error('Error updating bank account:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengupdate rekening bank' },
      { status: 500 }
    )
  }
}

// DELETE - Hapus rekening bank
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

    // Cek apakah rekening bank memiliki transaksi
    const transactionCount = await prisma.transaction.count({
      where: { bankAccountId: id }
    })

    if (transactionCount > 0) {
      return NextResponse.json(
        { error: 'Tidak dapat menghapus rekening bank yang memiliki transaksi' },
        { status: 400 }
      )
    }

    await prisma.bankAccount.delete({
      where: { id }
    })

    return NextResponse.json({
      message: 'Berhasil menghapus rekening bank'
    })
  } catch (error) {
    console.error('Error deleting bank account:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat menghapus rekening bank' },
      { status: 500 }
    )
  }
}
