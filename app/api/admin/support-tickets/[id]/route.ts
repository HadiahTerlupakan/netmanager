/**
 * Admin Support Tickets Detail Routes
 * Migrated to use standardized middleware and validation
 */

import { 
  withAuth, 
  withPermission, 
  withErrorHandler,
  withRateLimit,
  RateLimits,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  applySiteRestriction,
  type AuthContext,
  type RBACFilterContext
} from '@/lib/middleware'
import { apiSuccess } from '@/lib/api-response'
import { supportTicketUpdateSchema } from '@/lib/validations/support-ticket'
import { idSchema } from '@/lib/validations/common'
import { getAdminSupportTicketService } from '@/modules/pelanggan/services/AdminSupportTicketService'

interface SupportFilters {
  siteId?: string;
}

/**
 * GET /api/admin/support-tickets/[id]
 * Get single support ticket with all replies
 */
export const GET = withErrorHandler(
  withAuth(
    withPermission('support:read',
      applySiteRestriction('support:site_only',
        withRateLimit(RateLimits.STANDARD,
          async ({ user, filters }: AuthContext & RBACFilterContext<SupportFilters>, routeContext) => {
            const { id } = await (routeContext as { params: Promise<{ id: string }> }).params

            // Validate ID format
            const parseResult = idSchema.safeParse(id)
            if (!parseResult.success) {
              throw new ValidationError('ID tidak valid', { 
                errors: parseResult.error.flatten().fieldErrors 
              })
            }

            const hasSiteRestriction = !!filters.siteId
            const service = getAdminSupportTicketService()

            const result = await service.getTicketById(parseResult.data, {
              id: user.id,
              ...(user.role !== undefined && { role: user.role }),
              ...(user.siteId !== undefined && { siteId: user.siteId }),
            }, hasSiteRestriction)

            if (!result.success) {
              if (result.code === 'NOT_FOUND') {
                throw new NotFoundError('Tiket')
              }
              if (result.code === 'FORBIDDEN') {
                throw new ForbiddenError(result.error || 'Akses ditolak')
              }
              throw new Error(result.error || 'Gagal mengambil detail tiket')
            }

            return apiSuccess(result.data)
          }
        )
      )
    )
  )
)

/**
 * PATCH /api/admin/support-tickets/[id]
 * Update ticket (status, priority, assignee)
 */
export const PATCH = withErrorHandler(
  withAuth(
    withPermission('support:update',
      applySiteRestriction('support:site_only',
        async ({ user, request, filters }: AuthContext & { request: Request } & RBACFilterContext<SupportFilters>, routeContext) => {
          const { id } = await (routeContext as { params: Promise<{ id: string }> }).params

          // Validate ID format
          const idParseResult = idSchema.safeParse(id)
          if (!idParseResult.success) {
            throw new ValidationError('ID tidak valid', { 
              errors: idParseResult.error.flatten().fieldErrors 
            })
          }

          // Parse and validate request body
          const body = await request.json()
          const parseResult = supportTicketUpdateSchema.safeParse(body)

          if (!parseResult.success) {
            throw new ValidationError('Data tidak valid', { 
              errors: parseResult.error.flatten().fieldErrors 
            })
          }

          const hasSiteRestriction = !!filters.siteId
          const service = getAdminSupportTicketService()

          const updateData = {
            ...(parseResult.data.status !== undefined && { status: parseResult.data.status }),
            ...(parseResult.data.priority !== undefined && { priority: parseResult.data.priority }),
            ...(parseResult.data.assignedToId !== undefined && { assignedToId: parseResult.data.assignedToId }),
            ...(parseResult.data.resolution && { closingNote: parseResult.data.resolution }),
          }

          const result = await service.updateTicket(idParseResult.data, updateData, {
            id: user.id,
            ...(user.role !== undefined && { role: user.role }),
            ...(user.siteId !== undefined && { siteId: user.siteId }),
          }, hasSiteRestriction)

          if (!result.success) {
            if (result.code === 'NOT_FOUND') {
              throw new NotFoundError('Tiket')
            }
            if (result.code === 'FORBIDDEN') {
              throw new ForbiddenError(result.error || 'Akses ditolak')
            }
            throw new Error(result.error || 'Gagal mengupdate tiket')
          }

          return apiSuccess(result.data, { message: 'Tiket berhasil diupdate' })
        }
      )
    )
  )
)

/**
 * DELETE /api/admin/support-tickets/[id]
 * Delete support ticket
 */
export const DELETE = withErrorHandler(
  withAuth(
    withPermission('support:delete',
      applySiteRestriction('support:site_only',
        async ({ user, filters }: AuthContext & RBACFilterContext<SupportFilters>, routeContext) => {
          const { id } = await (routeContext as { params: Promise<{ id: string }> }).params

          // Validate ID format
          const parseResult = idSchema.safeParse(id)
          if (!parseResult.success) {
            throw new ValidationError('ID tidak valid', { 
              errors: parseResult.error.flatten().fieldErrors 
            })
          }

          const hasSiteRestriction = !!filters.siteId
          const service = getAdminSupportTicketService()

          const result = await service.deleteTicket(parseResult.data, {
            id: user.id,
            ...(user.role !== undefined && { role: user.role }),
            ...(user.siteId !== undefined && { siteId: user.siteId }),
          }, hasSiteRestriction)

          if (!result.success) {
            if (result.code === 'NOT_FOUND') {
              throw new NotFoundError('Tiket')
            }
            if (result.code === 'FORBIDDEN') {
              throw new ForbiddenError(result.error || 'Akses ditolak')
            }
            throw new Error(result.error || 'Gagal menghapus tiket')
          }

          return apiSuccess(result.data, { message: 'Tiket berhasil dihapus' })
        }
      )
    )
  )
)
