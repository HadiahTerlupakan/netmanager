import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getUserRepository } from '@/lib/repositories'
import { userCreateSchema } from '@/lib/validations/user'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'
import { logger } from '@/lib/logger'

// SIMPLIFIED RBAC: Only check if user is authenticated
// Authorization is controlled by CustomRole at UI level
async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session) {
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

    try {
      const dbStart = Date.now()

      // Get all users
      const users = await prisma.user.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      })

      // Get all employees with their relations including CustomRole
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
          customRoles: {
            include: {
              role: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                }
              }
            }
          },
        },
      })

      // Create a map of userId -> employee
      const employeeMap = new Map()
      employees.forEach(emp => {
        if (emp.userId) {
          // Get the first custom role (if any)
          const primaryRole = emp.customRoles?.[0]?.role
          employeeMap.set(emp.userId, {
            id: emp.id,
            employeeId: emp.employeeId,
            department: emp.department,
            position: emp.position,
            employmentStatus: emp.employmentStatus,
            customRoleName: primaryRole?.name || null,
            customRoleCode: primaryRole?.code || null,
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

    const formData = await req.json()
    const {
      email, name, password, roleId,
      employeeId, phone, dateOfBirth, gender, idCardNumber,
      address, city, province, departmentId, positionId,
      employmentStatus, joinDate, probationEndDate,
      bankName, bankAccountNumber, bankAccountName, npwp,
      emergencyName, emergencyPhone, emergencyRelation
    } = formData

    // Validate required fields using zod schema (use 'USER' as default role for schema validation)
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

    if (!roleId) {
      return NextResponse.json(
        { error: 'Role pengguna wajib dipilih' },
        { status: 400 }
      )
    }

    // Validate and fetch the custom role before proceeding
    const customRole = await prisma.customRole.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true,
        allowedFeatures: true,
        priority: true,
      }
    })

    if (!customRole) {
      console.error('Custom role not found:', { roleId })
      return NextResponse.json(
        { error: 'Role yang dipilih tidak ditemukan' },
        { status: 400 }
      )
    }

    console.log('[USER-CREATION] Custom role found:', {
      id: customRole.id,
      name: customRole.name,
      code: customRole.code,
      isActive: customRole.isActive,
      hasAllowedFeatures: !!customRole.allowedFeatures,
    })

    console.log('[USER-CREATION] Single Role System - Using custom role only:', {
      customRoleName: customRole.name,
      customRoleCode: customRole.code,
      isActive: customRole.isActive,
      hasPermissions: !!customRole.allowedFeatures
    })

    // Base role system removed - only custom roles are used now

    if (!customRole.isActive) {
      console.log('[USER-CREATION] WARNING: Custom role is inactive, activating it automatically')
      // Auto-activate the role if it's inactive
      await prisma.customRole.update({
        where: { id: roleId },
        data: { isActive: true }
      })
      console.log('[USER-CREATION] Custom role activated successfully')
    }

    // Validate allowedFeatures format
    if (customRole.allowedFeatures) {
      try {
        const parsed = JSON.parse(customRole.allowedFeatures)
        console.log('[USER-CREATION] Role allowedFeatures parsed successfully:', {
          type: typeof parsed,
          isArray: Array.isArray(parsed),
          keys: Array.isArray(parsed) ? null : Object.keys(parsed || {}),
        })
      } catch (e) {
        console.error('[USER-CREATION] ERROR: Invalid JSON in allowedFeatures:', customRole.allowedFeatures)
        return NextResponse.json(
          { error: 'Role yang dipilih memiliki format permission yang tidak valid' },
          { status: 400 }
        )
      }
    } else {
      console.log('[USER-CREATION] WARNING: Custom role has no allowedFeatures')
    }

    logger.info('Creating new user+employee', {
      email,
      customRoleId: customRole.id,
      customRoleName: customRole.name,
      customRoleCode: customRole.code,
      employeeId,
      createdBy: session.user.id,
    })

    const passwordHash = await hash(password, 10)

    try {
      // Create User + Employee + EmployeeRole in single transaction
      const result = await prisma.$transaction(async (tx) => {
        console.log('[USER-CREATION] Starting transaction...')
        // 1. Create User (no base role - single role system)
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
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
            gender: gender || null,
            idCardNumber: idCardNumber || null,
            address: address || null,
            city: city || null,
            province: province || null,
            departmentId: departmentId || null,
            positionId: positionId || null,
            employmentStatus: employmentStatus || 'PROBATION',
            joinDate: new Date(joinDate),
            probationEndDate: probationEndDate ? new Date(probationEndDate) : null,
            bankName: bankName || null,
            bankAccountNumber: bankAccountNumber || null,
            bankAccountName: bankAccountName || null,
            npwp: npwp || null,
            emergencyName: emergencyName || null,
            emergencyPhone: emergencyPhone || null,
            emergencyRelation: emergencyRelation || null,
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

        // 3. Create EmployeeRole to assign role to employee
        const employeeRole = await tx.employeeRole.create({
          data: {
            employeeId: employee.id,
            roleId: roleId,
            assignedBy: session.user.id,
          },
        })

        logger.dbOperation('create', 'EmployeeRole', Date.now() - startTime, {
          employeeRoleId: employeeRole.id,
          employeeId: employee.id,
          roleId: roleId,
        })
        console.log('[USER-CREATION] EmployeeRole created successfully:', {
          employeeRoleId: employeeRole.id,
          employeeId: employee.id,
          roleId: roleId,
          roleName: customRole.name
        })

        return { user, employee, employeeRole }
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
        customRoleName: customRole.name,
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
        roleId: roleId,
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
