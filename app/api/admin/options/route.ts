/**
 * Admin Options Routes
 * Migrated to use standardized middleware and validation
 * Provides dropdown options for forms (sites, departments, etc.)
 */

import { prisma } from '@/lib/prisma'
import { 
  withAuth, 
  withErrorHandler,
  withRateLimit,
  RateLimits
} from '@/lib/middleware'
import { apiSuccess } from '@/lib/api-response'

/**
 * GET /api/admin/options
 * Get dropdown options (sites, departments)
 * No permission check required - all authenticated users need access to options
 */
export const GET = withErrorHandler(
  withAuth(
    withRateLimit(RateLimits.STANDARD,
      async () => {
        const [sites, departments] = await Promise.all([
          prisma.sites.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
          }),
          prisma.departments.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
          })
        ])

        return apiSuccess({ sites, departments })
      }
    )
  )
)
