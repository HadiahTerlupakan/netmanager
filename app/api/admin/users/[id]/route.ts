// Cleaned up file content
import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { getUserPermissions } from '@/lib/auth'
import { getUserRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'
import { logger } from '@/lib/logger'
import { checkSiteRestriction, canAccessSite } from '@/lib/site-restriction'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

/**
 * @swagger
 * /api/admin/users/{id}:
 *   patch:
 *     summary: Update user
 *     description: Mengupdate data pengguna. Hanya bisa diakses oleh ADMIN.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 nullable: true
 *               password:
 *                 type: string
 *                 minLength: 8
 *               phone:
 *                 type: string
 *                 nullable: true
 *               isActive:
 *                 type: boolean
 *               departmentId:
 *                 type: string
 *                 nullable: true
 *               siteId:
 *                 type: string
 *                 nullable: true
 *               roleId:
 *                 type: string
 *                 nullable: true
 *
 *     responses:
 *       200:
 *         description: Pengguna berhasil diupdate
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User tidak ditemukan
 */
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(_req)
  if (session instanceof NextResponse) return session
  const { id } = await params

  let body
  try {
    body = await _req.json()
  } catch (error) {
    return apiError('Invalid JSON in request body', ErrorCodes.BAD_REQUEST, { status: 400 })
  }

  console.log('[USER-UPDATE] Updating user:', { id, body })

  // Validate input
  if (body.name !== undefined && typeof body.name !== 'string') {
    return apiError('Nama harus berupa string', ErrorCodes.VALIDATION_ERROR, { status: 400 })
  }

  if (body.password !== undefined) {
    if (typeof body.password !== 'string' || body.password.length < 6) {
      return apiError('Password minimal 6 karakter', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }
  }

  // Handle user data update
  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name
  if (body.password) data.passwordHash = await hash(body.password, 10)
  if (body.phone !== undefined) data.phone = body.phone || null
  if (body.departmentId !== undefined) data.departmentId = body.departmentId || null
  if (body.siteId !== undefined) data.siteId = body.siteId || null
  if (body.roleId !== undefined) data.roleId = body.roleId || null
  if (body.isActive !== undefined) data.isActive = body.isActive

  // Working Hours
  if (body.workingHourMode !== undefined) data.workingHourMode = body.workingHourMode
  if (body.startWorkTime !== undefined) data.startWorkTime = body.startWorkTime
  if (body.endWorkTime !== undefined) data.endWorkTime = body.endWorkTime
  if (body.workDays !== undefined) data.workDays = body.workDays
  if (body.flexibleTargetHour !== undefined) data.flexibleTargetHour = body.flexibleTargetHour
  if (body.shiftId !== undefined) data.shiftId = body.shiftId
  if (body.canvasingTarget !== undefined) data.canvasingTarget = parseInt(body.canvasingTarget) || 50
  if (body.isSales !== undefined) data.isSales = body.isSales

  // Salary
  if (body.basicSalary !== undefined) data.basicSalary = parseFloat(body.basicSalary) || null
  if (body.payPeriodDay !== undefined) data.payPeriodDay = parseInt(body.payPeriodDay) || 25
  if (body.payDay !== undefined) data.payDay = parseInt(body.payDay) || 1
  if (body.overtimeRateNormal !== undefined) data.overtimeRateNormal = parseFloat(body.overtimeRateNormal) || 0
  if (body.overtimeRateHoliday !== undefined) data.overtimeRateHoliday = parseFloat(body.overtimeRateHoliday) || 0
  if (body.overtimeRateNational !== undefined) data.overtimeRateNational = parseFloat(body.overtimeRateNational) || 0
  if (body.overtimeCalcTypeNormal !== undefined) data.overtimeCalcTypeNormal = body.overtimeCalcTypeNormal
  if (body.overtimeCalcTypeHoliday !== undefined) data.overtimeCalcTypeHoliday = body.overtimeCalcTypeHoliday
  if (body.overtimeCalcTypeNational !== undefined) data.overtimeCalcTypeNational = body.overtimeCalcTypeNational
  if (body.woIncentiveEnabled !== undefined) data.woIncentiveEnabled = body.woIncentiveEnabled
  if (body.woIncentiveRate !== undefined) data.woIncentiveRate = parseFloat(body.woIncentiveRate) || 0
  if (body.lateDeductionRate !== undefined) data.lateDeductionRate = parseFloat(body.lateDeductionRate) || 0
  if (body.absentDeductionRate !== undefined) data.absentDeductionRate = parseFloat(body.absentDeductionRate) || 0

  // Extract userSites for separate handling
  const userSites: Array<{ siteId: string; isPrimary: boolean }> | undefined = body.userSites

  console.log('[USER-UPDATE] Data to update:', data)

  try {
    // Check permissions
    const permissions = await getUserPermissions(session.user.id)
    const isSelfUpdate = session.user.id === id
    
    if (!permissions.includes('users:update')) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengupdate user')
    }

    // Check if we need to validate sensitive field changes
    const hasSensitiveFields = body.roleId !== undefined || body.siteId !== undefined || 
                              body.departmentId !== undefined || body.isActive !== undefined;
    
    let currentData = null;
    if (hasSensitiveFields) {
        currentData = await prisma.user.findUnique({
            where: { id },
            select: { roleId: true, siteId: true, departmentId: true, isActive: true }
        });
    }

    // IDOR Protection: Prevent self-update of sensitive fields
    if (isSelfUpdate && currentData) {
        if (body.roleId !== undefined && body.roleId !== currentData.roleId) {
          console.warn('[USER-UPDATE] SECURITY: Self role change attempt blocked', { userId: id, old: currentData.roleId, new: body.roleId })
          return ApiErrors.forbidden('Tidak dapat mengubah role sendiri')
        }
        if (body.siteId !== undefined && body.siteId !== currentData.siteId) {
          console.warn('[USER-UPDATE] SECURITY: Self site change attempt blocked', { userId: id })
          return ApiErrors.forbidden('Tidak dapat mengubah site sendiri')
        }
        if (body.departmentId !== undefined && body.departmentId !== currentData.departmentId) {
          console.warn('[USER-UPDATE] SECURITY: Self department change attempt blocked', { userId: id })
          return ApiErrors.forbidden('Tidak dapat mengubah departemen sendiri')
        }
        if (body.isActive !== undefined && body.isActive !== currentData.isActive) {
          console.warn('[USER-UPDATE] SECURITY: Self status change attempt blocked', { userId: id })
          return ApiErrors.forbidden('Tidak dapat mengubah status aktif sendiri')
        }
    }

    // NOTE: Granular permissions (users:update:role, users:update:site, etc) have been REMOVED
    // If user has 'users:update' permission, they can update ALL fields 
    // Only IDOR protection above prevents self-modification of sensitive fields

    // Site restriction check using centralized helper
    const { isRestricted, siteId: userSiteId } = checkSiteRestriction(session, 'users')

    if (isRestricted && !isSelfUpdate) {
      // Fetch target user to check their site
      const targetUser = await prisma.user.findUnique({
        where: { id },
        select: { siteId: true }
      })

      if (!targetUser) {
        return ApiErrors.notFound('User')
      }

      if (!canAccessSite(session, 'users', targetUser.siteId)) {
        return ApiErrors.forbidden('Anda hanya dapat mengupdate user di site Anda')
      }

      // Also prevent changing siteId to something else
      if (data.siteId && data.siteId !== userSiteId) {
        return ApiErrors.forbidden('Anda tidak dapat mengubah site user ke site lain')
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data,
    })

    // Handle multi-site update if userSites provided
    if (userSites !== undefined && Array.isArray(userSites)) {
      // Delete existing userSites
      await prisma.userSite.deleteMany({
        where: { userId: id }
      })

      // Insert new userSites
      if (userSites.length > 0) {
        await prisma.userSite.createMany({
          data: userSites.map(us => ({
            userId: id,
            siteId: us.siteId,
            isPrimary: us.isPrimary || false
          }))
        })

        // Update legacy siteId to primary site for backward compatibility
        const primarySite = userSites.find(us => us.isPrimary)
        if (primarySite) {
          await prisma.user.update({
            where: { id },
            data: { siteId: primarySite.siteId }
          })
        }
      } else {
        // Clear legacy siteId if no sites assigned
        await prisma.user.update({
          where: { id },
          data: { siteId: null }
        })
      }

      console.log('[USER-UPDATE] UserSites updated:', { userId: id, count: userSites.length })
    }

    // Invalidate permission cache if role changed
    if (body.roleId !== undefined) {
      const { invalidatePermissionCache } = await import('@/lib/auth')
      await invalidatePermissionCache(id)
      console.debug('[USER-UPDATE] Permission cache invalidated due to role change', { userId: id })
    }

    console.log('[USER-UPDATE] User updated successfully:', {
      id: updatedUser.id,
      email: updatedUser.email,
    })

    await logger.logActivity({
      action: 'UPDATE',
      subject: 'User',
      userId: session.user.id,
      details: {
        id: updatedUser.id,
        name: updatedUser.name,
        changes: Object.keys(data)
      }
    })

    return apiSuccess({ ok: true }, { message: 'User berhasil diperbarui' })
  } catch (error: any) {
    console.error('[USER-UPDATE] Error updating user:', error)

    if (error.code === 'P2025') {
      return ApiErrors.notFound('User')
    }

    return ApiErrors.internalError('Gagal mengupdate user')
  }
}

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Mengambil detail pengguna berdasarkan ID. Hanya bisa diakses oleh ADMIN.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Detail pengguna berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: clx1234567890
 *                     name:
 *                       type: string
 *                       nullable: true
 *                       example: John Doe
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: user@example.com
 *                     phone:
 *                       type: string
 *                       nullable: true
 *                       example: +62812345678
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *                     departmentId:
 *                       type: string
 *                       nullable: true
 *                     siteId:
 *                       type: string
 *                       nullable: true
 *                     roleId:
 *                       type: string
 *                       nullable: true
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     department:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                     site:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: string
 *                         code:
 *                           type: string
 *                         name:
 *                           type: string
 *                     role:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User tidak ditemukan
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(_req)
  if (session instanceof NextResponse) return session
  const { id } = await params

  // Validate ID
  if (!id || typeof id !== 'string') {
    return apiError('User ID tidak valid', ErrorCodes.VALIDATION_ERROR, { status: 400 })
  }

  try {
    // Fetch user with related data
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        departmentId: true,
        siteId: true,
        roleId: true,
        workingHourMode: true,
        startWorkTime: true,
        endWorkTime: true,
        workDays: true,
        flexibleTargetHour: true,
        canvasingTarget: true,
        isSales: true,
        shiftId: true,
        // Salary configuration
        basicSalary: true,
        payPeriodDay: true,
        payDay: true,
        woIncentiveEnabled: true,
        woIncentiveRate: true,
        lateDeductionRate: true,
        absentDeductionRate: true,
        overtimeRateNormal: true,
        overtimeRateHoliday: true,
        overtimeRateNational: true,
        overtimeCalcTypeNormal: true,
        overtimeCalcTypeHoliday: true,
        overtimeCalcTypeNational: true,
        shift: {
          select: { id: true, name: true, startTime: true, endTime: true }
        },
        departments: {
          select: { id: true, name: true },
        },
        sites: {
          select: { id: true, code: true, name: true },
        },
        role: {
          select: { id: true, name: true },
        },
        userSites: {
          select: {
            id: true,
            siteId: true,
            isPrimary: true,
            site: {
              select: { id: true, code: true, name: true }
            }
          },
          orderBy: { isPrimary: 'desc' }
        },
      },
    })

    if (!user) return ApiErrors.notFound('User')

    // Check permissions
    const permissions = await getUserPermissions(session.user.id)
    const isSelfView = session.user.id === id

    if (!permissions.includes('users:read') && !isSelfView) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat user')
    }

    // Site restriction check using centralized helper
    if (!isSelfView && !canAccessSite(session, 'users', user.siteId)) {
      return ApiErrors.forbidden('Anda hanya dapat melihat user di site Anda')
    }

    return apiSuccess({ user })
  } catch (e: any) {
    console.error('[USER-GET] Error fetching user:', e)

    // Handle specific database errors
    if (e.code === 'P1001') {
      return apiError('Database connection failed', ErrorCodes.INTERNAL_ERROR, { status: 503 })
    }

    if (e.code === 'P2002') {
      return ApiErrors.conflict('Database constraint violation')
    }

    return ApiErrors.internalError('Gagal memuat pengguna')
  }
}

/**
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     summary: Delete user
 *     description: Menghapus pengguna. Hanya bisa diakses oleh ADMIN.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Pengguna berhasil dihapus
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User tidak ditemukan
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(_req)
  if (session instanceof NextResponse) return session
  const { id } = await params

  // Validate ID
  if (!id || typeof id !== 'string') {
    return apiError('User ID tidak valid', ErrorCodes.VALIDATION_ERROR, { status: 400 })
  }

  try {
    const userRepository = getUserRepository()

    // Check permissions
    const permissions = await getUserPermissions(session.user.id)
    if (!permissions.includes('users:delete')) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus user')
    }

    // Site restriction check using centralized helper
    if (checkSiteRestriction(session, 'users').isRestricted) {
      const targetUser = await prisma.user.findUnique({
        where: { id },
        select: { siteId: true }
      })

      if (!targetUser) {
        return ApiErrors.notFound('User')
      }

      if (!canAccessSite(session, 'users', targetUser.siteId)) {
        return ApiErrors.forbidden('Anda hanya dapat menghapus user di site Anda')
      }
    }

    // Fetch user for logging
    const targetUserForLog = await prisma.user.findUnique({
      where: { id },
      select: { name: true }
    })

    await userRepository.delete(id)

    await logger.logActivity({
      action: 'DELETE',
      subject: 'User',
      userId: session.user.id,
      details: { id, name: targetUserForLog?.name }
    })

    return apiSuccess({ ok: true }, { message: 'User berhasil dihapus' })
  } catch (error: any) {
    console.error('[USER-DELETE] Error deleting user:', error)

    if (error.code === 'P2025') {
      return ApiErrors.notFound('User')
    }

    return ApiErrors.internalError('Gagal menghapus user')
  }
}
