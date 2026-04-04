import * as z from 'zod'
import { prisma } from '@/lib/prisma'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'

const historyQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['timestamp', 'cpuUsage', 'memoryUsage', 'temperature']).default('timestamp'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

/**
 * @swagger
 * /api/network/performance/{id}/history:
 *   get:
 *     summary: Get performance history for a device
 *     description: Mengambil riwayat performa untuk perangkat tertentu
 *     tags: [Network Performance]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Device ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by end date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Performance history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/NetworkPerformance'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Device not found
 *       500:
 *         description: Server error
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const { id } = ctx.params
    const { searchParams } = req.nextUrl
    const queryParams = Object.fromEntries(searchParams.entries())
    
    const parsed = historyQuerySchema.safeParse(queryParams)
    if (!parsed.success) {
      return ApiErrors.badRequest('Invalid query parameters', { errors: parsed.error.flatten() })
    }

    const filters = parsed.data
    const where: Record<string, unknown> = { deviceId: id }

    if (filters.startDate || filters.endDate) {
      const timestamp: Record<string, Date> = {}
      if (filters.startDate) timestamp.gte = new Date(filters.startDate)
      if (filters.endDate) timestamp.lte = new Date(filters.endDate)
      where.timestamp = timestamp
    }

    const page = filters.page || 1
    const limit = filters.limit || 20
    const skip = (page - 1) * limit

    const orderBy: Record<string, string> = {}
    if (filters.sortBy) {
      orderBy[filters.sortBy] = filters.sortOrder || 'desc'
    } else {
      orderBy.timestamp = 'desc'
    }

    try {
      const [data, total] = await Promise.all([
        prisma.networkPerformance.findMany({
          where,
          orderBy,
          skip,
          take: limit,
        }),
        prisma.networkPerformance.count({ where }),
      ])

      return apiSuccess({
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      })
    } catch (prismaError: unknown) {
      // Handle case where model doesn't exist yet
      if (prismaError && typeof prismaError === 'object' && 'code' in prismaError && prismaError.code === 'P2021') {
        return apiSuccess({
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
          message: 'Network performance monitoring will be available after database migration'
        })
      }
      throw prismaError
    }
})
