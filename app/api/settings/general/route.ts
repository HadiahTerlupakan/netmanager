import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type BankAccount = {
  id?: string
  namaBank: string
  atasNama: string
  noRekening: string
}

type GeneralSettings = {
  perusahaan: string
  alamat: string
  nomorHp: string
  deskripsiInvoice: string
  rekeningBank: BankAccount[]
  invoiceOtomatis: string
  disablePerpanjanganPaket: string
}

/**
 * GET /api/settings/general
 * Mengambil pengaturan umum
 */
export async function GET(req: NextRequest) {
  try {
    // Cek autentikasi
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Cek role admin
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Ambil semua pengaturan umum dari database
    const settings = await prisma.settings.findMany({
      where: {
        key: {
          in: [
            'GENERAL_PERUSAHAAN',
            'GENERAL_ALAMAT',
            'GENERAL_NOMOR_HP',
            'GENERAL_DESKRIPSI_INVOICE',
            'GENERAL_REKENING_BANK',
            'GENERAL_INVOICE_OTOMATIS',
            'GENERAL_DISABLE_PERPANJANGAN_PAKET',
          ],
        },
      },
    })

    // Convert ke object
    const settingsMap = new Map(settings.map((s) => [s.key, s.value]))

    // Parse rekening bank dari JSON
    let rekeningBank: BankAccount[] = []
    try {
      const rekeningBankStr = settingsMap.get('GENERAL_REKENING_BANK')
      if (rekeningBankStr) {
        rekeningBank = JSON.parse(rekeningBankStr)
      }
    } catch (e) {
      console.error('Error parsing rekening bank:', e)
    }

    return NextResponse.json({
      perusahaan: settingsMap.get('GENERAL_PERUSAHAAN') || '',
      alamat: settingsMap.get('GENERAL_ALAMAT') || '',
      nomorHp: settingsMap.get('GENERAL_NOMOR_HP') || '',
      deskripsiInvoice: settingsMap.get('GENERAL_DESKRIPSI_INVOICE') || '',
      rekeningBank,
      invoiceOtomatis: settingsMap.get('GENERAL_INVOICE_OTOMATIS') || '5',
      disablePerpanjanganPaket: settingsMap.get('GENERAL_DISABLE_PERPANJANGAN_PAKET') || '5',
    })
  } catch (error: any) {
    console.error('Error fetching general settings:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/settings/general
 * Menyimpan pengaturan umum
 */
export async function POST(req: NextRequest) {
  try {
    // Cek autentikasi
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Cek role admin
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body: GeneralSettings = await req.json()
    const {
      perusahaan,
      alamat,
      nomorHp,
      deskripsiInvoice,
      rekeningBank,
      invoiceOtomatis,
      disablePerpanjanganPaket,
    } = body

    // Upsert semua pengaturan
    await Promise.all([
      // Perusahaan
      prisma.settings.upsert({
        where: { key: 'GENERAL_PERUSAHAAN' },
        update: {
          value: perusahaan?.trim() || null,
          description: 'Nama perusahaan',
          updatedAt: new Date(),
        },
        create: {
          key: 'GENERAL_PERUSAHAAN',
          value: perusahaan?.trim() || null,
          description: 'Nama perusahaan',
          encrypted: false,
        },
      }),

      // Alamat
      prisma.settings.upsert({
        where: { key: 'GENERAL_ALAMAT' },
        update: {
          value: alamat?.trim() || null,
          description: 'Alamat perusahaan',
          updatedAt: new Date(),
        },
        create: {
          key: 'GENERAL_ALAMAT',
          value: alamat?.trim() || null,
          description: 'Alamat perusahaan',
          encrypted: false,
        },
      }),

      // Nomor HP
      prisma.settings.upsert({
        where: { key: 'GENERAL_NOMOR_HP' },
        update: {
          value: nomorHp?.trim() || null,
          description: 'Nomor HP perusahaan',
          updatedAt: new Date(),
        },
        create: {
          key: 'GENERAL_NOMOR_HP',
          value: nomorHp?.trim() || null,
          description: 'Nomor HP perusahaan',
          encrypted: false,
        },
      }),

      // Deskripsi Invoice
      prisma.settings.upsert({
        where: { key: 'GENERAL_DESKRIPSI_INVOICE' },
        update: {
          value: deskripsiInvoice?.trim() || null,
          description: 'Deskripsi invoice',
          updatedAt: new Date(),
        },
        create: {
          key: 'GENERAL_DESKRIPSI_INVOICE',
          value: deskripsiInvoice?.trim() || null,
          description: 'Deskripsi invoice',
          encrypted: false,
        },
      }),

      // Rekening Bank (simpan sebagai JSON)
      prisma.settings.upsert({
        where: { key: 'GENERAL_REKENING_BANK' },
        update: {
          value: JSON.stringify(rekeningBank || []),
          description: 'Daftar rekening bank',
          updatedAt: new Date(),
        },
        create: {
          key: 'GENERAL_REKENING_BANK',
          value: JSON.stringify(rekeningBank || []),
          description: 'Daftar rekening bank',
          encrypted: false,
        },
      }),

      // Invoice Otomatis
      prisma.settings.upsert({
        where: { key: 'GENERAL_INVOICE_OTOMATIS' },
        update: {
          value: invoiceOtomatis?.trim() || '5',
          description: 'Jumlah hari sebelum jatuh tempo untuk invoice otomatis',
          updatedAt: new Date(),
        },
        create: {
          key: 'GENERAL_INVOICE_OTOMATIS',
          value: invoiceOtomatis?.trim() || '5',
          description: 'Jumlah hari sebelum jatuh tempo untuk invoice otomatis',
          encrypted: false,
        },
      }),

      // Disable Perpanjangan Paket
      prisma.settings.upsert({
        where: { key: 'GENERAL_DISABLE_PERPANJANGAN_PAKET' },
        update: {
          value: disablePerpanjanganPaket?.trim() || '5',
          description: 'Jumlah hari sebelum jatuh tempo untuk disable perpanjangan paket',
          updatedAt: new Date(),
        },
        create: {
          key: 'GENERAL_DISABLE_PERPANJANGAN_PAKET',
          value: disablePerpanjanganPaket?.trim() || '5',
          description: 'Jumlah hari sebelum jatuh tempo untuk disable perpanjangan paket',
          encrypted: false,
        },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error saving general settings:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}






