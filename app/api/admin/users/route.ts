import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getUserRepository } from '@/lib/repositories'
import { userCreateSchema } from '@/lib/validations/user'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'
import { logger } from '@/lib/logger'

// Check if user is authenticated
async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session) {
    return null
  }
  return session
}

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
export async function GET() {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/users')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const dbStart = Date.now()

      // Get all users
      const users = await prisma.user.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      })

      // Get all employees
      const employees = await prisma.employee.findMany({
        where: {
          userId: {
            not: null
          }
        },
        include: {
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          position: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      })

      // Create a map of userId -> employee
      const employeeMap = new Map()
      employees.forEach(emp => {
        if (emp.userId) {
          employeeMap.set(emp.userId, {
            id: emp.id,
            employeeId: emp.employeeId,
            fullName: emp.fullName,
            department: emp.department,
            position: emp.position,
            status: emp.status,
          })
        }
      })

      // Merge users with their employee data
      const usersWithEmployees = users.map(user => ({
        ...user,
        employee: employeeMap.get(user.id) || null
      }))

      logger.dbOperation('findMany', 'User+Employee', Date.now() - dbStart)

      logger.apiRequest('GET', '/api/users', 200, Date.now() - startTime, {
        userId: session.user.id,
        userCount: users.length,
      })

      return NextResponse.json({ users: usersWithEmployees })
    } finally {
      // do not disconnect shared prisma client
    }
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
export async function POST(req: Request) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to POST /api/users')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.json()
    const {
      email, name, password,
      employeeId, phone, departmentId, positionId, joinDate
    } = formData

    // Validate required fields 
    // Removed role validation
    const parsed = userCreateSchema.safeParse({ email, name, password, role: 'USER' })
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    if (!employeeId || !joinDate) {
      return NextResponse.json(
        { error: 'Missing required fields: employeeId, joinDate' },
        { status: 400 }
      )
    }

    logger.info('Creating new user+employee', {
      email,
      employeeId,
      createdBy: session.user.id,
    })

    const passwordHash = await hash(password, 10)

    try {
      // Create User + Employee in single transaction
      const result = await prisma.$transaction(async (tx) => {
        console.log('[USER-CREATION] Starting transaction...')
        // 1. Create User
        const user = await tx.user.create({
          data: {
            email,
            name: name || null,
            passwordHash,
          },
        })

        logger.dbOperation('create', 'User', Date.now() - startTime, {
          userId: user.id,
        })
        console.log('[USER-CREATION] User created successfully:', { userId: user.id, email: user.email })

        // 2. Create Employee record linked to user
        const employee = await tx.employee.create({
          data: {
            employeeId: employeeId.toUpperCase(),
            fullName: name || email.split('@')[0],
            email,
            phone: phone || null,
            departmentId: departmentId || null,
            positionId: positionId || null,
            joinDate: new Date(joinDate),
            userId: user.id,
            createdBy: session.user.id,
          },
        })

        logger.dbOperation('create', 'Employee', Date.now() - startTime, {
          employeeId: employee.id,
          userId: user.id,
        })
        console.log('[USER-CREATION] Employee created successfully:', {
          employeeId: employee.id,
          employeeNumber: employee.employeeId,
          userId: user.id
        })

        // Role creation removed

        return { user, employee }
      })

      logger.apiRequest('POST', '/api/users', 200, Date.now() - startTime, {
        userId: session.user.id,
        newUserId: result.user.id,
        employeeId: result.employee.id,
      })
      console.log('[USER-CREATION] Transaction completed successfully:', {
        userId: result.user.id,
        employeeId: result.employee.id,
        employeeNumber: result.employee.employeeId,
      })

      return NextResponse.json({
        id: result.user.id,
        employeeId: result.employee.id,
        message: 'User & Employee created successfully',
      })
    } catch (e: any) {
      console.error('[USER-CREATION] ERROR:', {
        error: e.message,
        code: e.code,
        meta: e.meta,
        cause: e.cause,
        email: email,
        employeeId: employeeId,
      })
      logger.error('Error creating user', e, {
        path: '/api/users',
        method: 'POST',
      })

      if (e.code === 'P2002') {
        // Prisma unique constraint error
        return NextResponse.json({ error: 'Email or Employee ID already exists' }, { status: 409 })
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
