import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

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

// GET - Mendapatkan rekening bank berdasarkan ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authConfig)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bankAccount = await prisma.bankAccount.findUnique({
      where: { id: params.id },
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
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authConfig)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = updateBankAccountSchema.parse(body)

    const bankAccount = await prisma.bankAccount.update({
      where: { id: params.id },
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
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authConfig)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Cek apakah rekening bank memiliki transaksi
    const transactionCount = await prisma.transaction.count({
      where: { bankAccountId: params.id }
    })

    if (transactionCount > 0) {
      return NextResponse.json(
        { error: 'Tidak dapat menghapus rekening bank yang memiliki transaksi' },
        { status: 400 }
      )
    }

    await prisma.bankAccount.delete({
      where: { id: params.id }
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
