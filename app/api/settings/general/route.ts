import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { invalidateTimezoneCache } from '@/lib/utils/get-timezone'
import { logActivitySafe } from '@/lib/logger'
import {
  SettingsRepository,
  GENERAL_SETTINGS_KEYS,
  mapGeneralSettingsResponse,
  buildGeneralSettingsUpserts,
  type GeneralSettingsPayload,
} from '@/modules/settings'

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

/**
 * GET /api/settings/general
 * Mengambil pengaturan umum
 */
export const GET = createHandler({ auth: true, permissions: ['umum:read', 'settings:read'] }, async () => {
  const settings = await SettingsRepository.findManyByKeys(GENERAL_SETTINGS_KEYS)
  return apiSuccess(mapGeneralSettingsResponse(settings))
})

/**
 * POST /api/settings/general
 * Menyimpan pengaturan umum
 */
export const POST = createHandler({ auth: true, permissions: ['settings:update'] }, async (req, ctx) => {
  const body: GeneralSettingsPayload = await req.json()

  // Validasi body
  if (!body || typeof body !== 'object') {
    return ApiErrors.badRequest('Body request tidak valid')
  }

  await SettingsRepository.upsertMany(buildGeneralSettingsUpserts(body))

  // Invalidate both timezone caches (get-timezone.ts AND AttendanceTimezoneService)
  invalidateTimezoneCache()

  // Also invalidate AttendanceTimezoneService Redis cache
  const { AttendanceTimezoneService } = await import('@/modules/attendance')
  const tzService = new AttendanceTimezoneService()
  await tzService.invalidateCache().catch(() => {}) // Fire and forget

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
