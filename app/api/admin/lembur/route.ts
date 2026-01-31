/**
 * Admin Lembur (Overtime) Routes
 * Migrated to use standardized middleware and validation
 */

import { OvertimeService } from '@/modules/overtime'
import { 
  withAuth, 
  withPermission, 
  withErrorHandler, 
  withRateLimit,
  RateLimits,
  ValidationError,
  applyRBACRestrictions,
  type RBACFilterContext
} from '@/lib/middleware'
import { apiSuccess } from '@/lib/api-response'
import { lemburFilterSchema } from '@/lib/validations/lembur'
import { OvertimeStatus } from '@prisma/client'

interface LemburFilters {
  siteId?: string;
  departmentId?: string;
}

/**
 * GET /api/admin/lembur
 * List overtime requests with pagination and filters
 */
export const GET = withErrorHandler(
  withAuth(
    withPermission('lembur:read',
      applyRBACRestrictions(
        {
          sitePermission: 'lembur:site_only',
          departmentPermission: 'lembur:department_only'
        },
        withRateLimit(RateLimits.STANDARD,
          async ({ user: _user, request: _request, filters }: RBACFilterContext<LemburFilters>) => {
            // filters is already sanitized by applyRBACRestrictions using parseQuery

            // Validate query params with Zod
            const parseResult = lemburFilterSchema.safeParse(filters)

            if (!parseResult.success) {
              throw new ValidationError('Parameter tidak valid', parseResult.error.flatten().fieldErrors)
            }

            const { page, limit, startDate: startDateStr, endDate: endDateStr, status, holidayType } = parseResult.data
            const skip = (page - 1) * limit

            // Build filters for service
            const serviceFilters: {
              skip: number;
              take: number;
              status?: OvertimeStatus;
              holidayType?: string;
              siteId?: string;
              departmentId?: string;
              startDate?: Date;
              endDate?: Date;
            } = {
              skip,
              take: limit,
              status: status as OvertimeStatus | undefined,
              holidayType // Pass to service
            }

            // Apply RBAC restrictions from middleware
            if (filters.siteId) {
              serviceFilters.siteId = filters.siteId
            }
            if (filters.departmentId) {
              serviceFilters.departmentId = filters.departmentId
            }

            // Apply date range filter
            if (startDateStr && endDateStr) {
              const start = new Date(startDateStr)
              start.setHours(0, 0, 0, 0)
              const end = new Date(endDateStr)
              end.setHours(23, 59, 59, 999)
              serviceFilters.startDate = start
              serviceFilters.endDate = end
            }

            const service = new OvertimeService()
            const result = await service.getAllRequests(serviceFilters)

            return apiSuccess({
              data: result.data,
              summary: result.summary,
              pagination: {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit)
              }
            })
          }
        )
      )
    )
  )
)
