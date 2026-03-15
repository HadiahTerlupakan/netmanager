import { randomUUID } from 'crypto'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { invalidateTimezoneCache } from '@/lib/utils/get-timezone'
import { logActivitySafe } from '@/lib/logger'

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
 *
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
  email: string
  deskripsiInvoice: string
  rekeningBank: BankAccount[]
  invoiceOtomatis: string
  disablePerpanjanganPaket: string
  timezone: string
  attendanceTolerance: string
  pppConnectionMode?: string
  autoIsolirEnabled?: boolean
  autoIsolirHariToleransi?: string
  reminderOtomatis: string
  reminderFrequency: 'ONCE' | 'DAILY'
  reminderTime: string
  notifApp: boolean
  notifWa: boolean
  notifEmail: boolean
}

/**
 * GET /api/settings/general
 * Mengambil pengaturan umum
 */
export const GET = createHandler({ auth: true }, async () => {
  // Ambil semua pengaturan umum dari database
  const settings = await prisma.settings.findMany({
    where: {
      key: {
        in: [
          'GENERAL_PERUSAHAAN',
          'GENERAL_NAMA_APLIKASI',
          'GENERAL_ALAMAT',
          'GENERAL_NOMOR_HP',
          'GENERAL_EMAIL',
          'GENERAL_DESKRIPSI_INVOICE',
          'GENERAL_REKENING_BANK',
          'GENERAL_INVOICE_OTOMATIS',
          'GENERAL_DISABLE_PERPANJANGAN_PAKET',
          'GENERAL_TIMEZONE',
          'GENERAL_ATTENDANCE_TOLERANCE',
          'PPP_CONNECTION_MODE',
          'GENERAL_AUTO_ISOLASI_ENABLED',
          'GENERAL_AUTO_ISOLASI_HARI_TOLERANSI',
          'GENERAL_REMINDER_OTOMATIS',
          'GENERAL_REMINDER_FREQUENCY',
          'GENERAL_REMINDER_TIME',
          'GENERAL_NOTIF_APP',
          'GENERAL_NOTIF_WA',
          'GENERAL_NOTIF_EMAIL',
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

  return apiSuccess({
    perusahaan: settingsMap.get('GENERAL_PERUSAHAAN') || '',
    namaAplikasi: settingsMap.get('GENERAL_NAMA_APLIKASI') || 'NetManager',
    alamat: settingsMap.get('GENERAL_ALAMAT') || '',
    nomorHp: settingsMap.get('GENERAL_NOMOR_HP') || '',
    email: settingsMap.get('GENERAL_EMAIL') || '',
    deskripsiInvoice: settingsMap.get('GENERAL_DESKRIPSI_INVOICE') || '',
    rekeningBank,
    invoiceOtomatis: settingsMap.get('GENERAL_INVOICE_OTOMATIS') || '5',
    disablePerpanjanganPaket: settingsMap.get('GENERAL_DISABLE_PERPANJANGAN_PAKET') || '5',
    timezone: settingsMap.get('GENERAL_TIMEZONE') || 'Asia/Jakarta',
    attendanceTolerance: settingsMap.get('GENERAL_ATTENDANCE_TOLERANCE') || '0',
    pppConnectionMode: settingsMap.get('PPP_CONNECTION_MODE') || 'RADIUS',
    autoIsolirEnabled: settingsMap.get('GENERAL_AUTO_ISOLASI_ENABLED') !== 'false',
    autoIsolirHariToleransi: settingsMap.get('GENERAL_AUTO_ISOLASI_HARI_TOLERANSI') || '1',
    reminderOtomatis: settingsMap.get('GENERAL_REMINDER_OTOMATIS') || '3',
    reminderFrequency: (settingsMap.get('GENERAL_REMINDER_FREQUENCY') as 'ONCE' | 'DAILY') || 'DAILY',
    reminderTime: settingsMap.get('GENERAL_REMINDER_TIME') || '08:00',
    notifApp: settingsMap.get('GENERAL_NOTIF_APP') !== 'false',
    notifWa: settingsMap.get('GENERAL_NOTIF_WA') === 'true',
    notifEmail: settingsMap.get('GENERAL_NOTIF_EMAIL') === 'true',
  })
})

/**
 * POST /api/settings/general
 * Menyimpan pengaturan umum
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const body: GeneralSettings = await req.json()

  // Validasi body
  if (!body || typeof body !== 'object') {
    return ApiErrors.badRequest('Body request tidak valid')
  }

  const {
    perusahaan,
    namaAplikasi,
    alamat,
    nomorHp,
    email,
    deskripsiInvoice,
    rekeningBank,
    invoiceOtomatis,
    disablePerpanjanganPaket,
    timezone,
    attendanceTolerance,
    pppConnectionMode,
    autoIsolirEnabled,
    autoIsolirHariToleransi,
    reminderOtomatis,
    reminderFrequency,
    reminderTime,
    notifApp,
    notifWa,
    notifEmail,
  } = body

  // Upsert semua pengaturan
  const settingsToSave: Array<{ key: string; value: string | null; description: string }> = [
    { key: 'GENERAL_PERUSAHAAN', value: perusahaan?.trim() || null, description: 'Nama perusahaan' },
    { key: 'GENERAL_NAMA_APLIKASI', value: namaAplikasi?.trim() || 'NetManager', description: 'Nama Aplikasi' },
    { key: 'GENERAL_ALAMAT', value: alamat?.trim() || null, description: 'Alamat perusahaan' },
    { key: 'GENERAL_NOMOR_HP', value: nomorHp?.trim() || null, description: 'Nomor HP perusahaan' },
    { key: 'GENERAL_EMAIL', value: email?.trim() || null, description: 'Email perusahaan' },
    { key: 'GENERAL_DESKRIPSI_INVOICE', value: deskripsiInvoice?.trim() || null, description: 'Deskripsi invoice' },
    { key: 'GENERAL_REKENING_BANK', value: JSON.stringify(rekeningBank || []), description: 'Daftar rekening bank' },
    { key: 'GENERAL_INVOICE_OTOMATIS', value: invoiceOtomatis?.trim() || '5', description: 'Jumlah hari sebelum jatuh tempo untuk invoice otomatis' },
    { key: 'GENERAL_DISABLE_PERPANJANGAN_PAKET', value: disablePerpanjanganPaket?.trim() || '5', description: 'Jumlah hari sebelum jatuh tempo untuk disable perpanjangan paket' },
    { key: 'GENERAL_TIMEZONE', value: timezone?.trim() || 'Asia/Jakarta', description: 'Zona waktu aplikasi (IANA timezone)' },
    { key: 'GENERAL_ATTENDANCE_TOLERANCE', value: attendanceTolerance?.trim() || '0', description: 'Toleransi keterlambatan (menit)' },
    { key: 'PPP_CONNECTION_MODE', value: pppConnectionMode || 'RADIUS', description: 'Mode koneksi PPP: RADIUS atau MIKROTIK_API' },
    { key: 'GENERAL_AUTO_ISOLASI_ENABLED', value: autoIsolirEnabled === false ? 'false' : 'true', description: 'Aktifkan isolir otomatis' },
    { key: 'GENERAL_AUTO_ISOLASI_HARI_TOLERANSI', value: autoIsolirHariToleransi?.trim() || '1', description: 'Hari toleransi sebelum isolir otomatis' },
    { key: 'GENERAL_REMINDER_OTOMATIS', value: reminderOtomatis?.trim() || '3', description: 'Jumlah hari sebelum jatuh tempo untuk mulai kirim reminder' },
    { key: 'GENERAL_REMINDER_FREQUENCY', value: reminderFrequency || 'DAILY', description: 'Frekuensi pengiriman reminder (ONCE atau DAILY)' },
    { key: 'GENERAL_REMINDER_TIME', value: reminderTime?.trim() || '08:00', description: 'Jam pengiriman reminder' },
    { key: 'GENERAL_NOTIF_APP', value: notifApp === false ? 'false' : 'true', description: 'Toggle push notification app' },
    { key: 'GENERAL_NOTIF_WA', value: notifWa === true ? 'true' : 'false', description: 'Toggle notification WhatsApp' },
    { key: 'GENERAL_NOTIF_EMAIL', value: notifEmail === true ? 'true' : 'false', description: 'Toggle notification Email' },
  ]

  await Promise.all(
    settingsToSave.map(async ({ key, value, description }) => {
      const existing = await prisma.settings.findFirst({
        where: { key }
      })
      if (existing) {
        return prisma.settings.update({
          where: { id: existing.id },
          data: { value, description, updatedAt: new Date() }
        })
      } else {
        return prisma.settings.create({
          data: { id: randomUUID(), key, value, description, encrypted: false, updatedAt: new Date() }
        })
      }
    })
  )

  // Invalidate timezone cache agar cron jobs menggunakan timezone baru
  invalidateTimezoneCache()

  // System Log
  // ctx.session is guaranteed to exist because auth: true
  if (ctx.session?.user?.id) {
    logActivitySafe({
      action: 'UPDATE',
      subject: 'Settings',
      userId: ctx.session.user.id,
      details: { type: 'General', updates: body }
    })
  }

  return apiSuccess({ success: true })
})
