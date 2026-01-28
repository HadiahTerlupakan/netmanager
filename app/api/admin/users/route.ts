import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { getUserPermissions } from '@/lib/auth'
import { getUserService } from '@/modules/users'
import { userCreateSchema } from '@/lib/validations/user'
import { logger } from '@/lib/logger'
import { getSiteFilter, checkSiteRestriction } from '@/lib/site-restriction'
import { authorize, isAuthError } from '@/lib/authorization-middleware'
import { prisma } from '@/lib/prisma'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users
 *     description: Mengambil daftar semua pengguna. Hanya bisa diakses oleh ADMIN.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Daftar pengguna berhasil diambil
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  
  // Use centralized authorization middleware
  const auth = await authorize(req, {
    permissions: ['users:read'],
    siteRestricted: true
  })
  
  // Check authorization result
  if (isAuthError(auth)) {
    return auth.error
  }
  
  const { session } = auth
  
  try {
    // Get real-time permissions to ensure site restriction is applied correctly
    const permissions = await getUserPermissions(session.user.id)
    
    // Create augmented session with real permissions
    const sessionWithPermissions = {
        ...session,
        user: {
            ...session.user,
            permissions
        }
    }

    // Get site filter - use intelligent check (only filter if user has 'site_only' permission)
    const siteIdFilter = getSiteFilter(sessionWithPermissions as any, 'users')

    const userService = getUserService()
    const users = await userService.getAllUsers(siteIdFilter)

    logger.apiRequest('GET', '/api/admin/users', 200, Date.now() - startTime, {
      userId: session.user.id,
      count: users.length,
    })

    return apiSuccess({ users })
  } catch (error: any) {
    logger.error('Error fetching users', error, {
      path: '/api/admin/users',
      method: 'GET',
    })
    return ApiErrors.internalError('Gagal mengambil daftar pengguna')
  }
}

/**
 * @swagger
 * /api/admin/users:
 *   post:
 *     summary: Create a new user
 *     description: Membuat pengguna baru. Hanya bisa diakses oleh ADMIN.
 *     tags: [Users]
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  try {
    // Cek autentikasi admin menggunakan fungsi terpusat
    const session = await requireAdmin(req)

    let formData
    try {
      formData = await req.json()
    } catch (error) {
      return apiError('Invalid JSON in request body', ErrorCodes.BAD_REQUEST, { status: 400 })
    }

    const {
      email, name, password,
      phone, departmentId, siteId, isActive, roleId,
      userSites,  // Multi-site support
      // Working Hours Settings
      workingHourMode, startWorkTime, endWorkTime, workDays, flexibleTargetHour, shiftId,
      // Sales Feature
      isSales
    } = formData

    const permissions = await getUserPermissions(session.user.id)

    if (!permissions.includes('users:create')) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat user')
    }

    // Site restriction check using centralized helper
    const { isRestricted, siteId: userSiteId } = checkSiteRestriction(session, 'users')

    if (isRestricted) {
      if (!userSiteId) {
        return apiError('Configuration Error: User restricted to site but has no site assigned.', ErrorCodes.FORBIDDEN, { status: 403 })
      }
      if (siteId && siteId !== userSiteId) {
        return ApiErrors.forbidden('Anda hanya dapat membuat user untuk site Anda')
      }
      formData.siteId = userSiteId
    }

    // Validate required fields
    const parsed = userCreateSchema.safeParse({ email, name, password, role: 'ADMIN' })
    if (!parsed.success) {
      return apiError(
        'Data tidak valid',
        ErrorCodes.VALIDATION_ERROR,
        { status: 400, details: parsed.error.flatten().fieldErrors }
      )
    }

    logger.info('Creating new user', {
      email,
      createdBy: session.user.id,
      roleId
    })

    try {
      const userService = getUserService()
      const user = await userService.createUser({
        email,
        name,
        password,
        phone,
        departmentId,
        siteId,
        roleId,
        isActive,
        // Working Hours Settings
        workingHourMode: workingHourMode || 'FIXED',
        startWorkTime: startWorkTime || '09:00',
        endWorkTime: endWorkTime || '17:00',
        workDays: workDays || 'Mon,Tue,Wed,Thu,Fri',
        flexibleTargetHour: flexibleTargetHour ? parseInt(flexibleTargetHour) : 8,
        shiftId: shiftId || null,
        // Sales Feature
        isSales: isSales || false,
      })

      // Handle multi-site: create userSites records
      if (userSites && Array.isArray(userSites) && userSites.length > 0) {
        await prisma.userSite.createMany({
          data: userSites.map((us: { siteId: string; isPrimary: boolean }) => ({
            userId: user.id,
            siteId: us.siteId,
            isPrimary: us.isPrimary || false
          }))
        })

        // Update legacy siteId to primary site for backward compatibility
        const primarySite = userSites.find((us: { isPrimary: boolean }) => us.isPrimary)
        if (primarySite) {
          await prisma.user.update({
            where: { id: user.id },
            data: { siteId: primarySite.siteId }
          })
        }

        logger.info('UserSites created for new user', { userId: user.id, count: userSites.length })
      }

      logger.apiRequest('POST', '/api/admin/users', 200, Date.now() - startTime, {
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
    } catch (e: any) {
      console.error('[USER-CREATION] ERROR:', {
        error: e.message,
        email: email,
      })
      logger.error('Error creating user', e, {
        path: '/api/admin/users',
        method: 'POST',
      })

      // Handle specific errors from UserService
      if (e.message === 'Email already exists') {
        return ApiErrors.conflict('Email sudah terdaftar')
      }

      return ApiErrors.internalError(e.message || 'Gagal membuat pengguna')
    }
  } catch (error: any) {
    logger.error('Error in POST /api/admin/users', error, {
      path: '/api/admin/users',
      method: 'POST',
    })
    return ApiErrors.internalError('Gagal memuat permintaan')
  }
}
