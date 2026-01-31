import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { supportTicketFilterSchema } from '@/lib/validations/support-ticket'
import { getAdminSupportTicketService } from '@/modules/pelanggan/services/AdminSupportTicketService'
import { getSiteFilter } from '@/lib/site-restriction'
import { logger } from '@/lib/logger'

/**
 * @swagger
 * /api/admin/support-tickets:
 *   get:
 *     summary: List support tickets
 *     description: Mengambil daftar tiket dukungan dengan pagination dan filter.
 *     tags: [Support Tickets]
 */
export const GET = createHandler({
  auth: true,
  permissions: ['support:read']
}, async (req, ctx) => {
  const startTime = Date.now()
  const { session, query, permissions } = ctx

  if (!session) return ApiErrors.unauthorized()

  // Validate query params with Zod
  // ctx.query already handles multi-value params and sanitization of "", "null", "undefined"
  const parseResult = supportTicketFilterSchema.safeParse(query)

  if (!parseResult.success) {
    return ApiErrors.badRequest('Parameter tidak valid', parseResult.error.flatten().fieldErrors)
  }

  const validated = parseResult.data

  // Site restriction logic
  const sessionWithPermissions = {
    ...session,
    user: {
      ...session.user,
      permissions
    }
  }
  const siteId = getSiteFilter(sessionWithPermissions as Parameters<typeof getSiteFilter>[0], 'support')
  const hasSiteRestriction = !!siteId

  // Build service filters
  const serviceFilters = {
    ...validated,
    siteId
  }

  const service = getAdminSupportTicketService()
  const result = await service.getTickets(serviceFilters, {
    id: session.user.id,
    role: session.user.role || '',
    siteId: session.user.id, // Service expects siteId of the user if needed
  }, hasSiteRestriction)

  if (!result.success) {
    if (result.code === 'FORBIDDEN') {
      return ApiErrors.forbidden(result.error || 'Akses ditolak')
    }
    throw new Error(result.error || 'Gagal mengambil data tiket')
  }

  const tickets = (result.data as { tickets?: unknown[] })?.tickets;
  logger.apiRequest('GET', '/api/admin/support-tickets', 200, Date.now() - startTime, {
    userId: session.user.id,
    count: tickets?.length || 0
  })

  return apiSuccess(result.data)
})
