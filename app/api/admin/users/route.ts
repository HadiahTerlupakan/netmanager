import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { getUserService } from '@/modules/users'
import { createUserSchema } from '@/lib/validations/user'
import { logger } from '@/lib/logger'
import { getSiteFilter, checkSiteRestriction } from '@/modules/roles'
import { prisma } from '@/lib/prisma'
import type { Session } from 'next-auth'

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users
 *     description: Mengambil daftar semua pengguna. Hanya bisa diakses oleh ADMIN.
 *     tags: [Users]
 */
export const GET = createHandler({
  auth: true,
  permissions: ['users:read']
}, async (req, ctx) => {
  const startTime = Date.now()
  const { session, permissions } = ctx

  if (!session) return ApiErrors.unauthorized()

  // Augmented session for site restriction helper
  const sessionWithPermissions = {
    ...session,
    user: {
      ...session.user,
      permissions
    }
  }

  // Get site filter
  const siteIdFilter = getSiteFilter(sessionWithPermissions as Session, 'users')

  const userService = getUserService()
  const users = await userService.getAllUsers(siteIdFilter)

  logger.apiRequest('GET', '/api/admin/users', 200, Date.now() - startTime, {
    userId: session.user.id,
    count: users.length,
  })

  return apiSuccess({ users })
})

/**
 * @swagger
 * /api/admin/users:
 *   post:
 *     summary: Create a new user
 *     description: Membuat pengguna baru. Hanya bisa diakses oleh ADMIN.
 *     tags: [Users]
 */
export const POST = createHandler({
  auth: true,
  permissions: ['users:create'],
  schema: createUserSchema
}, async (req, ctx) => {
  const startTime = Date.now()
  const { session, validated: body } = ctx
  
  if (!session) return ApiErrors.unauthorized()

  // Site restriction check using centralized helper
  const { isRestricted, siteId: userSiteId } = checkSiteRestriction(session as Session, 'users')

  if (isRestricted) {
    if (!userSiteId) {
      return ApiErrors.forbidden('User restricted to site but has no site assigned.')
    }
    if (body.siteId && body.siteId !== userSiteId) {
      return ApiErrors.forbidden('Anda hanya dapat membuat user untuk site Anda')
    }
    body.siteId = userSiteId
  }

  logger.info('Creating new user', {
    email: body.email,
    createdBy: session.user.id,
    roleId: body.roleId
  })

  try {
    const userService = getUserService()
    const user = await userService.createUser({
      email: body.email,
      name: body.name,
      password: body.password,
      ...(body.phone && { phone: body.phone }),
      ...(body.departmentId && { departmentId: body.departmentId }),
      ...(body.siteId && { siteId: body.siteId }),
      ...(body.roleId && { roleId: body.roleId }),
      isActive: body.isActive ?? true,
      // Working Hours Settings
      workingHourMode: body.workingHourMode || 'FIXED',
      ...(body.startWorkTime && { startWorkTime: body.startWorkTime }),
      ...(body.endWorkTime && { endWorkTime: body.endWorkTime }),
      ...(body.workDays && { workDays: body.workDays }),
      flexibleTargetHour: body.flexibleTargetHour ? parseInt(body.flexibleTargetHour.toString()) : 8,
      ...(body.shiftId && { shiftId: body.shiftId }),
      // Sales Feature
      isSales: body.isSales || false,
    })

    // Handle multi-site: create userSites records
    if (body.userSites && Array.isArray(body.userSites) && body.userSites.length > 0) {
      await prisma.userSite.createMany({
        data: body.userSites.map((us: { siteId: string; isPrimary: boolean }) => ({
          userId: user.id,
          siteId: us.siteId,
          isPrimary: us.isPrimary || false
        }))
      })

      // Update legacy siteId to primary site for backward compatibility
      const primarySite = body.userSites.find((us: { isPrimary: boolean }) => us.isPrimary)
      if (primarySite) {
        await prisma.user.update({
          where: { id: user.id },
          data: { siteId: primarySite.siteId }
        })
      }

      logger.info('UserSites created for new user', { userId: user.id, count: body.userSites.length })
    }

    logger.apiRequest('POST', '/api/admin/users', 201, Date.now() - startTime, {
      userId: session.user.id,
      newUserId: user.id,
    })

    // System Log
    await logger.logActivity({
      action: 'CREATE',
      subject: 'User',
      userId: session.user.id,
      details: { id: user.id, email: user.email }
    })

    return apiSuccess({ id: user.id }, { status: 201, message: 'User berhasil dibuat' })
  } catch (e: unknown) {
    if (e instanceof Error && e.message === 'Email already exists') {
      return ApiErrors.conflict('Email sudah terdaftar')
    }
    throw e // Let createHandler deal with general errors
  }
})
