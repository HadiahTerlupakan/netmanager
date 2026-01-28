import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import { HolidayRepository } from '@/modules/attendance/repositories/HolidayRepository'
import { requireAdmin } from '@/lib/auth-helpers'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'
import { z } from 'zod'

const holidayRepo = new HolidayRepository()

/**
 * Validation schema for creating holiday
 */
const createHolidaySchema = z.object({
    date: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date format'),
    description: z.string().min(1, 'Description is required').max(255),
    isNational: z.boolean().optional().default(true),
})

export async function GET(request: NextRequest) {
    const session = await requireAdmin(request)
    if (session instanceof Response) return session

    const hasAccess = await hasPermission('holiday:read')
    if (!hasAccess) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat hari libur')
    }

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()

    try {
        const holidays = await holidayRepo.getHolidaysByYear(year)
        return apiSuccess(holidays)
    } catch (error) {
        console.error('Fetch holidays error:', error)
        return ApiErrors.internalError('Gagal mengambil data hari libur')
    }
}


export async function POST(request: NextRequest) {
    const session = await requireAdmin(request)
    if (session instanceof Response) return session

    const hasAccess = await hasPermission('holiday:create')
    if (!hasAccess) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat hari libur')
    }

    try {
        const body = await request.json()
        
        // Validate with Zod
        const parseResult = createHolidaySchema.safeParse(body)
        if (!parseResult.success) {
            return apiError(
                'Data tidak valid',
                ErrorCodes.VALIDATION_ERROR,
                { status: 400, details: parseResult.error.flatten().fieldErrors }
            )
        }

        const { date, description, isNational } = parseResult.data

        const holiday = await holidayRepo.create({
            id: randomUUID(),
            date: new Date(date),
            description,
            isNational,
            updatedAt: new Date()
        })

        return apiSuccess(holiday, { status: 201, message: 'Hari libur berhasil dibuat' })
    } catch (error: any) {
        if (error.code === 'P2002') {
            return ApiErrors.conflict('Hari libur untuk tanggal ini sudah ada')
        }
        console.error('Create holiday error:', error)
        return ApiErrors.internalError('Gagal membuat hari libur')
    }
}
