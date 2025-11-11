import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getUserRepository } from '@/lib/repositories'
import { userCreateSchema } from '@/lib/validations/user'
import { hash } from 'bcryptjs'
import { logger } from '@/lib/logger'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || session?.user?.role !== 'ADMIN') {
    return null
  }
  return session
}

/**
 * @swagger
 * /api/users:
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
export async function GET() {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/users')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRepository = getUserRepository()
    const dbStart = Date.now()
    const users = await userRepository.findAll()
    logger.dbOperation('findAll', 'User', Date.now() - dbStart)

    logger.apiRequest('GET', '/api/users', 200, Date.now() - startTime, {
      userId: session.user.id,
      userCount: users.length,
    })

    return NextResponse.json({ users })
  } catch (error: any) {
    logger.error('Error fetching users', error, {
      path: '/api/users',
      method: 'GET',
    })
    return NextResponse.json(
      { error: 'Gagal memuat data pengguna' },
      { status: 500 }
    )
  }
}

/**
 * @swagger
 * /api/users:
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
 *               - role
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
 *               role:
 *                 type: string
 *                 enum: [USER, ADMIN]
 *                 example: USER
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
export async function POST(req: Request) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to POST /api/users')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const json = await req.json()
    const parsed = userCreateSchema.safeParse(json)
    if (!parsed.success) {
      logger.warn('Validation error in POST /api/users', {
        errors: parsed.error.flatten(),
        userId: session.user.id,
      })
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { email, name, password, role } = parsed.data
    logger.info('Creating new user', {
      email,
      role,
      createdBy: session.user.id,
    })

    const passwordHash = await hash(password, 10)
    const dbStart = Date.now()
    const userRepository = getUserRepository()
    const user = await userRepository.create({ email, name: name || null, passwordHash, role })
    logger.dbOperation('create', 'User', Date.now() - dbStart, {
      userId: user.id,
    })

    logger.apiRequest('POST', '/api/users', 200, Date.now() - startTime, {
      userId: session.user.id,
      newUserId: user.id,
    })

    return NextResponse.json({ id: user.id })
  } catch (e: any) {
    logger.error('Error creating user', e, {
      path: '/api/users',
      method: 'POST',
    })
    
    if (e.code === 'P2002') {
      // Prisma unique constraint error
      return NextResponse.json({ error: 'Email sudah terpakai' }, { status: 409 })
    }
    
    return NextResponse.json(
      { error: 'Gagal membuat pengguna' },
      { status: 500 }
    )
  }
}


