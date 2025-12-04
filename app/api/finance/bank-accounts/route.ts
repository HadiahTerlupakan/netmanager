import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

const prisma = new PrismaClient()

// Schema validasi untuk bank account
const bankAccountSchema = z.object({
  namaBank: z.string().min(1, 'Nama bank harus diisi'),
  nomorRekening: z.string().min(1, 'Nomor rekening harus diisi'),
  namaPemilik: z.string().min(1, 'Nama pemilik harus diisi'),
  saldoAwal: z.string().transform((val) => BigInt(val)),
  mataUang: z.string().default('IDR'),
  isActive: z.boolean().default(true),
})

// GET - Mendapatkan semua rekening bank
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const bankAccounts = await prisma.bankAccount.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Convert BigInt to string for JSON serialization
    const serializedAccounts = bankAccounts.map(account => ({
      ...account,
      saldoAwal: account.saldoAwal.toString(),
      saldoSaatIni: account.saldoSaatIni.toString(),
    }))

    return NextResponse.json({
      data: serializedAccounts,
      message: 'Berhasil mengambil data rekening bank'
    })
  } catch (error) {
    console.error('Error fetching bank accounts:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat mengambil data rekening bank' },
      { status: 500 }
    )
  }
}

// POST - Membuat rekening bank baru
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authConfig)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = bankAccountSchema.parse(body)

    const bankAccount = await prisma.bankAccount.create({
      data: {
        ...validatedData,
        saldoSaatIni: validatedData.saldoAwal, // Saldo saat ini sama dengan saldo awal saat dibuat
        createdBy: session.user.id,
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
      message: 'Berhasil membuat rekening bank baru'
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating bank account:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan saat membuat rekening bank' },
      { status: 500 }
    )
  }
}
