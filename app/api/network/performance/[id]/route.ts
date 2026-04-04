import { prisma } from '@/modules/database'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'

/**
 * @swagger
 * /api/network/performance/{id}:
 *   get:
 *     summary: Get network performance data by ID
 *     description: Mengambil data performa jaringan berdasarkan ID
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
 *         description: Performance data ID
 *     responses:
 *       200:
 *         description: Network performance data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NetworkPerformance'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Performance data not found
 *       500:
 *         description: Server error
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const { id } = ctx.params

    try {
      const performanceData = await prisma.networkPerformance.findUnique({
        where: { id },
      })

      if (!performanceData) {
        return ApiErrors.notFound('Data performa')
      }

      return apiSuccess({ data: performanceData })
    } catch (prismaError: unknown) {
      // Handle case where model doesn't exist yet
      if (prismaError instanceof Error && (prismaError as unknown as Record<string, unknown>).code === 'P2021') {
        return ApiErrors.internalError('Network performance monitoring will be available after database migration')
      }
      throw prismaError
    }
})
