/**
 * Admin Holidays Routes
 * Migrated to use standardized middleware and validation
 */

import { randomUUID } from 'crypto'
import { HolidayRepository } from '@/modules/attendance/repositories/HolidayRepository'
import { 
  withAuth, 
  withPermission, 
  withErrorHandler,
  withRateLimit,
  RateLimits,
  ValidationError,
  ConflictError,
  type AuthContext
} from '@/lib/middleware'
import { apiSuccess } from '@/lib/api-response'
import { z } from 'zod'

const holidayRepo = new HolidayRepository()

/**
 * Validation schemas
 */
const holidayFilterSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).default(() => new Date().getFullYear()),
})

const createHolidaySchema = z.object({
  date: z.string().refine((val) => !isNaN(Date.parse(val)), 'Invalid date format'),
  description: z.string().min(1, 'Description is required').max(255),
  isNational: z.boolean().optional().default(true),
})

/**
 * GET /api/admin/holidays
 * List holidays by year
 */
export const GET = withErrorHandler(
  withAuth(
    withPermission('holiday:read',
      withRateLimit(RateLimits.STANDARD,
        async ({ request }: AuthContext) => {
          const { searchParams } = new URL(request.url)

          // Validate query params
          const parseResult = holidayFilterSchema.safeParse({
            year: searchParams.get('year'),
          })

          if (!parseResult.success) {
            throw new ValidationError('Parameter tidak valid', { 
              errors: parseResult.error.flatten().fieldErrors 
            })
          }

          const holidays = await holidayRepo.getHolidaysByYear(parseResult.data.year)
          return apiSuccess(holidays)
        }
      )
    )
  )
)

/**
 * POST /api/admin/holidays
 * Create new holiday
 */
export const POST = withErrorHandler(
  withAuth(
    withPermission('holiday:create',
      async ({ request }: AuthContext) => {
        const body = await request.json()
        
        // Validate with Zod
        const parseResult = createHolidaySchema.safeParse(body)
        if (!parseResult.success) {
          throw new ValidationError('Data tidak valid', { 
            errors: parseResult.error.flatten().fieldErrors 
          })
        }

        const { date, description, isNational } = parseResult.data

        try {
          const holiday = await holidayRepo.create({
            id: randomUUID(),
            date: new Date(date),
            description,
            isNational,
            updatedAt: new Date()
          })

          return apiSuccess(holiday, { status: 201, message: 'Hari libur berhasil dibuat' })
        } catch (error: unknown) {
          if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
            throw new ConflictError('Hari libur untuk tanggal ini sudah ada')
          }
          throw error
        }
      }
    )
  )
)
