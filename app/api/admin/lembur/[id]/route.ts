/**
 * Admin Lembur (Overtime) Single Record Routes
 * Migrated to use standardized middleware and validation
 */

import { prisma } from '@/lib/prisma'
import { OvertimeService } from '@/modules/overtime'
import { 
  withAuth, 
  withPermission, 
  withErrorHandler,
  withRateLimit,
  RateLimits,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  applyRBACRestrictions,
  type RBACFilterContext
} from '@/lib/middleware'
import { apiSuccess } from '@/lib/api-response'
import { lemburActionSchema } from '@/lib/validations/lembur'
import { idSchema } from '@/lib/validations/common'
import { logger } from '@/lib/logger'

interface LemburFilters {
  siteId?: string;
  departmentId?: string;
}

/**
 * GET /api/admin/lembur/[id]
 * Retrieve single overtime record
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
          async ({ user: _user, request: _request, filters }: RBACFilterContext<LemburFilters>, routeContext) => {
            const { id } = await (routeContext as { params: Promise<{ id: string }> }).params

            // Validate ID format
            const parseResult = idSchema.safeParse(id)
            if (!parseResult.success) {
              throw new ValidationError('ID tidak valid', { 
                errors: parseResult.error.flatten().fieldErrors 
              })
            }

            // Fetch overtime with user details
            const overtime = await prisma.overtime.findUnique({
              where: { id: parseResult.data },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                    siteId: true,
                    departmentId: true,
                    departments: { select: { name: true } },
                    sites: { select: { name: true } }
                  }
                }
              }
            })

            if (!overtime) {
              throw new NotFoundError('Data lembur tidak ditemukan')
            }

            // Apply RBAC filtering
            const recordUser = overtime.user
            if (filters.siteId && recordUser.siteId !== filters.siteId) {
              throw new NotFoundError('Data lembur tidak ditemukan')
            }
            if (filters.departmentId && recordUser.departmentId !== filters.departmentId) {
              throw new NotFoundError('Data lembur tidak ditemukan')
            }

            return apiSuccess(overtime)
          }
        )
      )
    )
  )
)

/**
 * PATCH /api/admin/lembur/[id]
 * Update or verify overtime record
 * Handles both approval/rejection (requires lembur:verify) and data updates (requires lembur:update)
 */
export const PATCH = withErrorHandler(
  withAuth(
    applyRBACRestrictions(
      {
        sitePermission: 'lembur:site_only',
        departmentPermission: 'lembur:department_only'
      },
      async ({ user, request, filters }: RBACFilterContext<LemburFilters>, routeContext) => {
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
        const parseResult = lemburActionSchema.safeParse(body)

        if (!parseResult.success) {
          throw new ValidationError('Data tidak valid', { 
            errors: parseResult.error.flatten().fieldErrors 
          })
        }

        const { action, reason, startTime, endTime } = parseResult.data

        // Check ownership & site/dept restrictions
        const existing = await prisma.overtime.findUnique({
          where: { id: idParseResult.data },
          include: { user: true }
        })

        if (!existing) {
          throw new NotFoundError('Data lembur tidak ditemukan')
        }

        // Apply RBAC filtering
        const recordUser = existing.user
        if (filters.siteId && recordUser.siteId !== filters.siteId) {
          throw new NotFoundError('Data lembur tidak ditemukan')
        }
        if (filters.departmentId && recordUser.departmentId !== filters.departmentId) {
          throw new NotFoundError('Data lembur tidak ditemukan')
        }

        const service = new OvertimeService()

        // Distinguish between APPROVE/REJECT (Verify) vs EDIT (Update)
        if (action === 'approve' || action === 'reject') {
          // VERIFICATION ACTIONS - Use withPermission inline check
          const { hasPermission } = await import('@/lib/rbac')
          if (!await hasPermission('lembur:verify', user)) {
            throw new ForbiddenError('Anda membutuhkan permission lembur:verify')
          }

          if (action === 'approve') {
            const result = await service.approveRequest(idParseResult.data, user.id || 'system')

            // System Log
            try {
              await logger.logActivity({
                action: 'UPDATE',
                subject: 'Overtime',
                userId: user.id,
                details: { id: idParseResult.data, action: 'APPROVE' }
              })
            } catch (e) { 
              console.error('Logging failed', e) 
            }

            return apiSuccess(result, { message: 'Lembur berhasil disetujui' })
          } else {
            if (!reason) {
              throw new ValidationError('Alasan penolakan wajib diisi', {})
            }
            const result = await service.rejectRequest(idParseResult.data, reason)

            // System Log
            try {
              await logger.logActivity({
                action: 'UPDATE',
                subject: 'Overtime',
                userId: user.id,
                details: { id: idParseResult.data, action: 'REJECT', reason }
              })
            } catch (e) { 
              console.error('Logging failed', e) 
            }

            return apiSuccess(result, { message: 'Lembur berhasil ditolak' })
          }
        } else {
          // EDIT DATA ACTIONS - Use withPermission inline check
          const { hasPermission } = await import('@/lib/rbac')
          if (!await hasPermission('lembur:update', user)) {
            throw new ForbiddenError('Anda membutuhkan permission lembur:update')
          }

          // Clean up update data
          const cleanData: { reason?: string; startTime?: Date; endTime?: Date } = {}
          if (reason) cleanData.reason = reason
          if (startTime) cleanData.startTime = new Date(startTime)
          if (endTime) cleanData.endTime = new Date(endTime)

          const result = await prisma.overtime.update({
            where: { id: idParseResult.data },
            data: cleanData,
            include: {
              user: {
                select: {
                  name: true,
                  email: true,
                  departments: { select: { name: true } },
                  sites: { select: { name: true } }
                }
              }
            }
          })

          // System Log
          try {
            await logger.logActivity({
              action: 'UPDATE',
              subject: 'Overtime',
              userId: user.id,
              details: { id: idParseResult.data, updates: cleanData }
            })
          } catch (e) { 
            console.error('Logging failed', e) 
          }

          return apiSuccess(result, { message: 'Data lembur berhasil diperbarui' })
        }
      }
    )
  )
)

/**
 * DELETE /api/admin/lembur/[id]
 * Remove overtime record
 */
export const DELETE = withErrorHandler(
  withAuth(
    withPermission('lembur:delete',
      applyRBACRestrictions(
        {
          sitePermission: 'lembur:site_only',
          departmentPermission: 'lembur:department_only'
        },
        async ({ user, filters }: RBACFilterContext<LemburFilters>, routeContext) => {
          const { id } = await (routeContext as { params: Promise<{ id: string }> }).params

          // Validate ID format
          const parseResult = idSchema.safeParse(id)
          if (!parseResult.success) {
            throw new ValidationError('ID tidak valid', { 
              errors: parseResult.error.flatten().fieldErrors 
            })
          }

          // Check existence and apply RBAC
          const existing = await prisma.overtime.findUnique({
            where: { id: parseResult.data },
            include: { user: true }
          })

          if (!existing) {
            throw new NotFoundError('Data lembur tidak ditemukan')
          }

          // Apply RBAC filtering
          const recordUser = existing.user
          if (filters.siteId && recordUser.siteId !== filters.siteId) {
            throw new NotFoundError('Data lembur tidak ditemukan')
          }
          if (filters.departmentId && recordUser.departmentId !== filters.departmentId) {
            throw new NotFoundError('Data lembur tidak ditemukan')
          }

          const service = new OvertimeService()
          await service.deleteOvertime(parseResult.data)

          // System Log
          try {
            await logger.logActivity({
              action: 'DELETE',
              subject: 'Overtime',
              userId: user.id,
              details: { id: parseResult.data }
            })
          } catch (e) { 
            console.error('Logging failed', e) 
          }

          return apiSuccess({ id: parseResult.data }, { message: 'Lembur berhasil dihapus' })
        }
      )
    )
  )
)
