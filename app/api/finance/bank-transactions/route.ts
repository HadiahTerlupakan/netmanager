import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

// Schema validasi untuk transaksi bank
const bankTransactionSchema = z.object({
  bankAccountId: z.string().min(1, 'ID rekening bank harus diisi'),
  tanggal: z.string().transform((val) => new Date(val)),
  tipeTransaksi: z.enum(['DEBIT', 'KREDIT']),
  kategori: z.string().min(1, 'Kategori harus diisi'),
  deskripsi: z.string().min(1, 'Deskripsi harus diisi'),
  jumlah: z.string().transform((val) => BigInt(val)),
  nomorReferensi: z.string().optional(),
})

// GET - Mendapatkan semua transaksi bank
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const bankAccountId = searchParams.get('bankAccountId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    const where = bankAccountId ? { bankAccountId } : {}

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        bankAccount: {
          select: {
            id: true,
            namaBank: true,
            nomorRekening: true,
          }
        }
      },
      orderBy: {
        tanggal: 'desc'
      },
      skip: offset,
      take: limit,
    })

    const total = await prisma.transaction.count({ where })

    // Convert BigInt to string for JSON serialization
    const serializedTransactions = transactions.map(transaction => ({
      ...transaction,
      jumlah: transaction.jumlah.toString(),
      saldoSebelumnya: transaction.saldoSebelumnya.toString(),
      saldoSetelahnya: transaction.saldoSetelahnya.toString(),
    }))

    return NextResponse.json({
      data: serializedTransactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      message: 'Berhasil mengambil data transaksi bank'
    })
  } catch (error) {
    console.error('Error fetching bank transactions:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data transaksi bank' },
      { status: 500 }
    )
  }
}

// POST - Membuat transaksi bank baru
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = bankTransactionSchema.parse(body)

    // Ambil data rekening bank untuk mendapatkan saldo saat ini
    const bankAccount = await prisma.bankAccount.findUnique({
      where: { id: validatedData.bankAccountId }
    })

    if (!bankAccount) {
      return NextResponse.json({ error: 'Rekening bank tidak ditemukan' }, { status: 404 })
    }

    // Hitung saldo sebelumnya dan setelahnya
    const saldoSebelumnya = bankAccount.saldoSaatIni
    let saldoSetelahnya: BigInt

    if (validatedData.tipeTransaksi === 'DEBIT') {
      saldoSetelahnya = saldoSebelumnya + validatedData.jumlah
    } else {
      saldoSetelahnya = saldoSebelumnya - validatedData.jumlah
    }

    // Buat transaksi baru
    const transaction = await prisma.transaction.create({
      data: {
        ...validatedData,
        saldoSebelumnya,
        saldoSetelahnya,
        createdBy: session.user.id,
      }
    })

    // Update saldo rekening bank
    await prisma.bankAccount.update({
      where: { id: validatedData.bankAccountId },
      data: {
        saldoSaatIni: saldoSetelahnya,
        updatedBy: session.user.id,
      }
    })

    // Convert BigInt to string for JSON serialization
    const serializedTransaction = {
      ...transaction,
      jumlah: transaction.jumlah.toString(),
      saldoSebelumnya: transaction.saldoSebelumnya.toString(),
      saldoSetelahnya: transaction.saldoSetelahnya.toString(),
    }

    return NextResponse.json({
      data: serializedTransaction,
      message: 'Berhasil membuat transaksi bank baru'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating bank transaction:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat membuat transaksi bank' },
      { status: 500 }
    )
  }
}
