import { randomUUID } from 'crypto'
import { HolidayRepository } from '@/modules/attendance'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import * as z from 'zod'
import { logger } from '@/lib/logger'
import { hasPermission } from '@/lib/rbac'

const holidayRepo = new HolidayRepository()

const holidayFilterSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).default(() => new Date().getFullYear()),
})

const createHolidaySchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date format'),
  description: z.string().min(1, 'Description is required').max(255),
  isNational: z.boolean().optional().default(true),
})

/**
 * GET /api/admin/holidays - List holidays by year
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('holiday:read')) {
        return ApiErrors.forbidden('Akses ditolak')
    }

    const { searchParams } = req.nextUrl
    const parseResult = holidayFilterSchema.safeParse({
        year: searchParams.get('year'),
    })

    if (!parseResult.success) {
        return ApiErrors.badRequest('Parameter tidak valid', { errors: parseResult.error.flatten().fieldErrors })
    }

    const tenantId = ctx.session!.user.tenantId
    if (!tenantId) return ApiErrors.badRequest('Tenant ID tidak ditemukan')

    const holidays = await holidayRepo.getHolidaysByYear(parseResult.data.year, tenantId)
    return apiSuccess(holidays)
})

/**
 * POST /api/admin/holidays - Create new holiday
 */
export const POST = createHandler({ 
    auth: true, 
    schema: createHolidaySchema 
}, async (req, ctx) => {
    if (!await hasPermission('holiday:create')) {
        return ApiErrors.forbidden('Akses ditolak')
    }

    const { date, description, isNational } = ctx.validated
    const tenantId = ctx.session!.user.tenantId
    if (!tenantId) return ApiErrors.badRequest('Tenant ID tidak ditemukan')

    try {
        const holiday = await holidayRepo.create({
            id: randomUUID(),
            date: new Date(date),
            description,
            isNational,
            updatedAt: new Date()
        }, tenantId)

        await logger.logActivity({
            action: 'CREATE',
            subject: 'Holiday',
            details: { id: holiday.id, date: holiday.date, description: holiday.description },
            userId: ctx.session!.user.id,
            tenantId
        })

        return apiSuccess(holiday, { status: 201, message: 'Hari libur berhasil dibuat' })
    } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
            return ApiErrors.conflict('Hari libur untuk tanggal ini sudah ada')
        }
        throw error
    }
})
