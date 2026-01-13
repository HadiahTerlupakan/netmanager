import { NextResponse, NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { getUserPermissions } from '@/lib/auth'
import { getUserService } from '@/modules/users'
import { userCreateSchema } from '@/lib/validations/user'
import { logger } from '@/lib/logger'
import { getSiteFilter, checkSiteRestriction } from '@/lib/site-restriction'
import { authorize, isAuthError } from '@/lib/authorization-middleware'

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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - Tidak memiliki akses
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
    // Get site filter - if user has site restriction, filter by their site
    const siteIdFilter = session.user.siteId || undefined

    const userService = getUserService()
    const users = await userService.getAllUsers(siteIdFilter)

    logger.apiRequest('GET', '/api/admin/users', 200, Date.now() - startTime, {
      userId: session.user.id,
      count: users.length,
    })

    return NextResponse.json({ users })
  } catch (error: any) {
    logger.error('Error fetching users', error, {
      path: '/api/admin/users',
      method: 'GET',
    })
    return NextResponse.json(
      { error: 'Gagal mengambil daftar pengguna' },
      { status: 500 }
    )
  }
}

/**
 * @swagger
 * /api/admin/users:
 *   post:
 *     summary: Create a new user
 *     description: Membuat pengguna baru. Hanya bisa diakses oleh ADMIN.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email pengguna
 *               name:
 *                 type: string
 *                 description: Nama lengkap pengguna
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Kata sandi pengguna
 *               phone:
 *                 type: string
 *                 description: Nomor telepon pengguna
 *               departmentId:
 *                 type: string
 *                 format: uuid
 *                 description: ID departemen pengguna
 *               siteId:
 *                 type: string
 *                 format: uuid
 *                 description: ID lokasi pengguna
 *               isActive:
 *                 type: boolean
 *                 description: Status aktif pengguna
 *                 default: true
 *               roleId:
 *                 type: string
 *                 format: uuid
 *                 description: ID peran pengguna
 *     responses:
 *       200:
 *         description: Pengguna berhasil dibuat
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad Request - Input tidak valid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Tidak memiliki akses
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Conflict - Email sudah terdaftar
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
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  try {
    // Cek autentikasi admin menggunakan fungsi terpusat
    const session = await requireAdmin(req)

    let formData
    try {
      formData = await req.json()
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const {
      email, name, password,
      phone, departmentId, siteId, isActive, roleId
    } = formData

    // const permissions = (session.user as any).permissions || []
    const permissions = await getUserPermissions(session.user.id)

    if (!permissions.includes('users:create')) {
      return NextResponse.json({ error: 'Unauthorized: You do not have permission to create users.' }, { status: 403 })
    }

    // Site restriction check using centralized helper
    const { isRestricted, siteId: userSiteId } = checkSiteRestriction(session, 'users')

    if (isRestricted) {
      if (!userSiteId) {
        return NextResponse.json({ error: 'Configuration Error: User restricted to site but has no site assigned.' }, { status: 403 })
      }
      if (siteId && siteId !== userSiteId) {
        return NextResponse.json({ error: 'Unauthorized: You can only create users for your assigned site.' }, { status: 403 })
      }
      // Force siteId to be the user's site if not provided or to ensure consistency
      formData.siteId = userSiteId
    }

    // Validate required fields
    const parsed = userCreateSchema.safeParse({ email, name, password, role: 'ADMIN' })
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
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
      })

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

      return NextResponse.json({
        id: user.id,
        message: 'User created successfully',
      })
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
        return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
      }

      return NextResponse.json(
        { error: e.message || 'Gagal membuat pengguna' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    logger.error('Error in POST /api/admin/users', error, {
      path: '/api/admin/users',
      method: 'POST',
    })
    return NextResponse.json(
      { error: 'Gagal memuat permintaan' },
      { status: 500 }
    )
  }
}
