import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { invalidateTimezoneCache } from '@/lib/utils/get-timezone'

/**
 * @swagger
 * /api/settings/general:
 *   get:
 *     summary: Get general application settings
 *     description: Retrieve general configuration settings for the application
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved general settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 perusahaan:
 *                   type: string
 *                   description: Company name
 *                   example: "PT. Internet Sejahtera"
 *                 namaAplikasi:
 *                   type: string
 *                   description: Application name
 *                   example: "NetManager"
 *                 alamat:
 *                   type: string
 *                   description: Company address
 *                   example: "Jl. Sudirman No. 123, Jakarta"
 *                 nomorHp:
 *                   type: string
 *                   description: Company phone number
 *                   example: "+628123456789"
 *                 deskripsiInvoice:
 *                   type: string
 *                   description: Invoice description template
 *                   example: "Payment for internet service"
 *                 rekeningBank:
 *                   type: array
 *                   description: Bank accounts list
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       namaBank:
 *                         type: string
 *                         example: "BCA"
 *                       atasNama:
 *                         type: string
 *                         example: "PT. Internet Sejahtera"
 *                       noRekening:
 *                         type: string
 *                         example: "1234567890"
 *                 invoiceOtomatis:
 *                   type: string
 *                   description: Days before due date for automatic invoice
 *                   example: "5"
 *                 disablePerpanjanganPaket:
 *                   type: string
 *                   description: Days before due date to disable package extension
 *                   example: "5"
 *                 timezone:
 *                   type: string
 *                   description: Application timezone (IANA format)
 *                   example: "Asia/Jakarta"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/Error'
 *
 *   post:
 *     summary: Update general application settings
 *     description: Update general configuration settings for the application
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               perusahaan:
 *                 type: string
 *                 description: Company name
 *                 example: "PT. Internet Sejahtera"
 *               namaAplikasi:
 *                 type: string
 *                 description: Application name
 *                 example: "NetManager"
 *               alamat:
 *                 type: string
 *                 description: Company address
 *                 example: "Jl. Sudirman No. 123, Jakarta"
 *               nomorHp:
 *                 type: string
 *                 description: Company phone number
 *                 example: "+628123456789"
 *               deskripsiInvoice:
 *                 type: string
 *                 description: Invoice description template
 *                 example: "Payment for internet service"
 *               rekeningBank:
 *                 type: array
 *                 description: Bank accounts list
 *                 items:
 *                   type: object
 *                   required:
 *                     - namaBank
 *                     - atasNama
 *                     - noRekening
 *                   properties:
 *                     id:
 *                       type: string
 *                     namaBank:
 *                       type: string
 *                       example: "BCA"
 *                     atasNama:
 *                       type: string
 *                       example: "PT. Internet Sejahtera"
 *                     noRekening:
 *                       type: string
 *                       example: "1234567890"
 *               invoiceOtomatis:
 *                 type: string
 *                 description: Days before due date for automatic invoice
 *                 example: "5"
 *               disablePerpanjanganPaket:
 *                 type: string
 *                 description: Days before due date to disable package extension
 *                 example: "5"
 *               timezone:
 *                 type: string
 *                 description: Application timezone (IANA format)
 *                 example: "Asia/Jakarta"
 *     responses:
 *       200:
 *         description: Successfully updated settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/Error'
 */

type BankAccount = {
  id?: string
  namaBank: string
  atasNama: string
  noRekening: string
}

type GeneralSettings = {
  perusahaan: string
  namaAplikasi: string
  alamat: string
  nomorHp: string
  deskripsiInvoice: string
  rekeningBank: BankAccount[]
  invoiceOtomatis: string
  disablePerpanjanganPaket: string
  timezone: string
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
    if (false) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Ambil semua pengaturan umum dari database
    const settings = await prisma.settings.findMany({
      where: {
        key: {
          in: [
            'GENERAL_PERUSAHAAN',
            'GENERAL_NAMA_APLIKASI',
            'GENERAL_ALAMAT',
            'GENERAL_NOMOR_HP',
            'GENERAL_DESKRIPSI_INVOICE',
            'GENERAL_REKENING_BANK',
            'GENERAL_INVOICE_OTOMATIS',
            'GENERAL_DISABLE_PERPANJANGAN_PAKET',
            'GENERAL_TIMEZONE',
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
      namaAplikasi: settingsMap.get('GENERAL_NAMA_APLIKASI') || 'NetManager',
      alamat: settingsMap.get('GENERAL_ALAMAT') || '',
      nomorHp: settingsMap.get('GENERAL_NOMOR_HP') || '',
      deskripsiInvoice: settingsMap.get('GENERAL_DESKRIPSI_INVOICE') || '',
      rekeningBank,
      invoiceOtomatis: settingsMap.get('GENERAL_INVOICE_OTOMATIS') || '5',
      disablePerpanjanganPaket: settingsMap.get('GENERAL_DISABLE_PERPANJANGAN_PAKET') || '5',
      timezone: settingsMap.get('GENERAL_TIMEZONE') || 'Asia/Jakarta',
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
    if (false) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body: GeneralSettings = await req.json()

    // Validasi body
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    const {
      perusahaan,
      namaAplikasi,
      alamat,
      nomorHp,
      deskripsiInvoice,
      rekeningBank,
      invoiceOtomatis,
      disablePerpanjanganPaket,
      timezone,
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

      // Nama Aplikasi
      prisma.settings.upsert({
        where: { key: 'GENERAL_NAMA_APLIKASI' },
        update: {
          value: namaAplikasi?.trim() || 'NetManager',
          description: 'Nama Aplikasi',
          updatedAt: new Date(),
        },
        create: {
          key: 'GENERAL_NAMA_APLIKASI',
          value: namaAplikasi?.trim() || 'NetManager',
          description: 'Nama Aplikasi',
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

      // Timezone
      prisma.settings.upsert({
        where: { key: 'GENERAL_TIMEZONE' },
        update: {
          value: timezone?.trim() || 'Asia/Jakarta',
          description: 'Zona waktu aplikasi (IANA timezone)',
          updatedAt: new Date(),
        },
        create: {
          key: 'GENERAL_TIMEZONE',
          value: timezone?.trim() || 'Asia/Jakarta',
          description: 'Zona waktu aplikasi (IANA timezone)',
          encrypted: false,
        },
      }),
    ])

    // Invalidate timezone cache agar cron jobs menggunakan timezone baru
    invalidateTimezoneCache()

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error saving general settings:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}









