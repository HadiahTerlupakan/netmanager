import { NextResponse, NextRequest } from 'next/server'
import { requireAdmin, getCurrentSession } from '@/lib/auth-helpers'
import { getUserRepository } from '@/lib/repositories'
import { userCreateSchema } from '@/lib/validations/user'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'
import { logger } from '@/lib/logger'

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
  try {
    // Cek autentikasi admin menggunakan fungsi terpusat
    const session = await requireAdmin(req)

    try {
      const dbStart = Date.now()

      // Get all users
      const users = await prisma.user.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      })

      logger.dbOperation('findMany', 'User', Date.now() - dbStart)

      logger.apiRequest('GET', '/api/users', 200, Date.now() - startTime, {
        userId: session.user.id,
        userCount: users.length,
      })

      return NextResponse.json({ users })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error fetching users', error, {
      path: '/api/users',
      method: 'GET',
    })

    // Handle specific database errors
    if (error.code === 'P1001') {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 503 }
      )
    }

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Database constraint violation' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Gagal memuat data pengguna' },
      { status: 500 }
    )
  }
}

/**
 * @swagger
 * /api/admin/users:
 *   post:
 *     summary: Create new user
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
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               name:
 *                 type: string
 *                 nullable: true
 *                 example: John Doe
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: password123
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
 *                   example: clx1234567890
 *       400:
 *         description: Validation error
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
 *         description: Email sudah terpakai
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
      phone, departmentId, siteId, isActive
    } = formData

    // Validate required fields
    const parsed = userCreateSchema.safeParse({ email, name, password, role: 'ADMIN' })
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    logger.info('Creating new user', {
      email,
      createdBy: session.user.id,
    })

    const passwordHash = await hash(password, 10)

    try {
      // Create User with all fields
      const user = await prisma.user.create({
        data: {
          email,
          name: name || null,
          passwordHash,
          phone: phone || null,
          departmentId: departmentId || null,
          siteId: siteId || null,
          isActive: isActive !== undefined ? isActive : true,
        },
      })

      logger.dbOperation('create', 'User', Date.now() - startTime, {
        userId: user.id,
      })
      console.log('[USER-CREATION] User created successfully:', { userId: user.id, email: user.email })

      logger.apiRequest('POST', '/api/users', 200, Date.now() - startTime, {
        userId: session.user.id,
        newUserId: user.id,
      })

      return NextResponse.json({
        id: user.id,
        message: 'User created successfully',
      })
    } catch (e: any) {
      console.error('[USER-CREATION] ERROR:', {
        error: e.message,
        code: e.code,
        meta: e.meta,
        cause: e.cause,
        email: email,
      })
      logger.error('Error creating user', e, {
        path: '/api/users',
        method: 'POST',
      })

      // Handle specific database errors
      if (e.code === 'P1001') {
        return NextResponse.json(
          { error: 'Database connection failed' },
          { status: 503 }
        )
      }

      if (e.code === 'P2002') {
        // Prisma unique constraint error
        return NextResponse.json({ error: 'Email already exists' }, { status: 409 })
      }

      if (e.code === 'P2003') {
        // Foreign key constraint error
        return NextResponse.json(
          { error: 'Invalid department or site reference' },
          { status: 400 }
        )
      }

      // Handle JSON parsing errors
      if (e instanceof SyntaxError && e.message.includes('JSON')) {
        return NextResponse.json(
          { error: 'Invalid JSON in request body' },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { error: e.message || 'Gagal membuat pengguna' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    logger.error('Error in POST /api/users', error, {
      path: '/api/users',
      method: 'POST',
    })
    return NextResponse.json(
      { error: 'Gagal memuat permintaan' },
      { status: 500 }
    )
  }
}
