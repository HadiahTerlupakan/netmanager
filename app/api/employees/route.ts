import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { employeeQuerySchema, employeeCreateSchema } from '@/lib/validations/employee'
import { logger } from '@/lib/logger'
import { requireAuth, getCurrentSession } from '@/lib/auth-helpers'

/**
 * @swagger
 * /api/employees:
 *   get:
 *     summary: Get all employees
 *     description: Mengambil daftar semua karyawan dengan pagination dan filtering
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Nomor halaman
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Jumlah data per halaman
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Pencarian berdasarkan nama atau employee ID
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *         description: Filter berdasarkan department ID
 *       - in: query
 *         name: positionId
 *         schema:
 *           type: string
 *         description: Filter berdasarkan position ID
 *       - in: query
 *         name: siteId
 *         schema:
 *           type: string
 *         description: Filter berdasarkan site ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, ON_LEAVE, TERMINATED]
 *         description: Filter berdasarkan status
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter berdasarkan status aktif
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [employeeId, fullName, joinDate, createdAt, updatedAt]
 *           default: createdAt
 *         description: Urutkan berdasarkan
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Urutan
 *     responses:
 *       200:
 *         description: Daftar karyawan berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 employees:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Employee'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  // Check authentication using centralized function
  const authResult = await requireAuth(request)
  if (authResult) return authResult
  
  const session = await getCurrentSession(request)

  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const query = Object.fromEntries(searchParams.entries())
    
    const queryResult = employeeQuerySchema.safeParse(query)
    
    if (!queryResult.success) {
      return NextResponse.json(
        { error: 'Query validation error', details: queryResult.error.flatten() },
        { status: 400 }
      )
    }
    
    const parsedQuery = queryResult.data
    
    // Build where clause
    const where: any = {}
    
    if (parsedQuery.search) {
      where.OR = [
        { fullName: { contains: parsedQuery.search, mode: 'insensitive' } },
        { employeeId: { contains: parsedQuery.search, mode: 'insensitive' } },
        { email: { contains: parsedQuery.search, mode: 'insensitive' } },
      ]
    }
    
    if (parsedQuery.departmentId) {
      where.departmentId = parsedQuery.departmentId
    }
    
    if (parsedQuery.positionId) {
      where.positionId = parsedQuery.positionId
    }
    
    if (parsedQuery.siteId) {
      where.siteId = parsedQuery.siteId
    }
    
    if (parsedQuery.status) {
      where.status = parsedQuery.status
    }
    
    if (parsedQuery.isActive !== undefined) {
      where.isActive = parsedQuery.isActive
    }
    
    // Calculate pagination
    const skip = (parsedQuery.page - 1) * parsedQuery.limit
    
    // Get total count
    const total = await prisma.employee.count({ where })
    
    // Get employees
    const employees = await prisma.employee.findMany({
      where,
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
            level: true,
          },
        },
        site: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: {
        [parsedQuery.sortBy]: parsedQuery.sortOrder,
      },
      skip,
      take: parsedQuery.limit,
    })
    
    // Calculate pagination info
    const totalPages = Math.ceil(total / parsedQuery.limit)
    
    logger.apiRequest('GET', '/api/employees', 200, Date.now() - startTime, {
      page: parsedQuery.page,
      limit: parsedQuery.limit,
      total,
    })
    
    return NextResponse.json({
      employees,
      pagination: {
        page: parsedQuery.page,
        limit: parsedQuery.limit,
        total,
        totalPages,
      },
    })
  } catch (error: any) {
    logger.error('Error fetching employees', error, {
      path: '/api/employees',
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
      { error: 'Gagal memuat data karyawan' },
      { status: 500 }
    )
  }
}

/**
 * @swagger
 * /api/employees:
 *   post:
 *     summary: Create new employee
 *     description: Membuat karyawan baru
 *     tags: [Employees]
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
 *               - employeeId
 *               - fullName
 *               - joinDate
 *             properties:
 *               employeeId:
 *                 type: string
 *                 example: EMP001
 *               fullName:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john.doe@example.com
 *               phone:
 *                 type: string
 *                 example: +628123456789
 *               departmentId:
 *                 type: string
 *               positionId:
 *                 type: string
 *               siteId:
 *                 type: string
 *               joinDate:
 *                 type: string
 *                 format: date
 *                 example: 2024-01-01
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE, ON_LEAVE, TERMINATED]
 *                 default: ACTIVE
 *               isActive:
 *                 type: boolean
 *                 default: true
 *               userId:
 *                 type: string
 *               dateOfBirth:
 *                 type: string
 *                 format: date
 *               gender:
 *                 type: string
 *                 enum: [MALE, FEMALE]
 *               idCardNumber:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               province:
 *                 type: string
 *               employmentStatus:
 *                 type: string
 *                 enum: [PROBATION, PERMANENT, CONTRACT]
 *                 default: PROBATION
 *               probationEndDate:
 *                 type: string
 *                 format: date
 *               bankName:
 *                 type: string
 *               bankAccountNumber:
 *                 type: string
 *               bankAccountName:
 *                 type: string
 *               npwp:
 *                 type: string
 *               emergencyName:
 *                 type: string
 *               emergencyPhone:
 *                 type: string
 *               emergencyRelation:
 *                 type: string
 *     responses:
 *       200:
 *         description: Karyawan berhasil dibuat
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 employeeId:
 *                   type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Employee ID already exists
 *       500:
 *         description: Server error
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  // Check authentication using centralized function
  const authResult = await requireAuth(request)
  if (authResult) return authResult
  
  const session = await getCurrentSession(request)
  
  try {
    let body
    try {
      body = await request.json()
    } catch (jsonError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }
    
    const result = employeeCreateSchema.safeParse(body)
    
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation error', details: result.error.flatten() },
        { status: 400 }
      )
    }
    
    const parsed = result.data
    
    // Check if employee ID already exists
    const existingEmployee = await prisma.employee.findUnique({
      where: { employeeId: parsed.employeeId },
    })
    
    if (existingEmployee) {
      return NextResponse.json(
        { error: 'Employee ID already exists' },
        { status: 409 }
      )
    }
    
    // Check if email already exists (if provided)
    if (parsed.email) {
      const existingEmail = await prisma.employee.findUnique({
        where: { email: parsed.email },
      })
      
      if (existingEmail) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 409 }
        )
      }
    }
    
    // Get session for createdBy (already retrieved above)
    
    // Create employee with explicit field mapping
    const employee = await prisma.employee.create({
      data: {
        employeeId: parsed.employeeId,
        fullName: parsed.fullName,
        email: parsed.email || undefined,
        phone: parsed.phone || undefined,
        joinDate: parsed.joinDate || new Date(),
        status: parsed.status || 'ACTIVE',
        isActive: parsed.isActive !== undefined ? parsed.isActive : true,
        employmentStatus: parsed.employmentStatus || 'PROBATION',
        dateOfBirth: parsed.dateOfBirth || undefined,
        gender: parsed.gender || undefined,
        idCardNumber: parsed.idCardNumber || undefined,
        address: parsed.address || undefined,
        city: parsed.city || undefined,
        province: parsed.province || undefined,
        probationEndDate: parsed.probationEndDate || undefined,
        bankName: parsed.bankName || undefined,
        bankAccountNumber: parsed.bankAccountNumber || undefined,
        bankAccountName: parsed.bankAccountName || undefined,
        npwp: parsed.npwp || undefined,
        emergencyName: parsed.emergencyName || undefined,
        emergencyPhone: parsed.emergencyPhone || undefined,
        emergencyRelation: parsed.emergencyRelation || undefined,
        departmentId: parsed.departmentId || undefined,
        positionId: parsed.positionId || undefined,
        siteId: parsed.siteId || undefined,
        createdBy: (session as any)?.user?.id,
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
            level: true,
          },
        },
        site: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    })
    
    logger.apiRequest('POST', '/api/employees', 200, Date.now() - startTime, {
      employeeId: employee.id,
      createdBy: (session as any)?.user?.id,
    })
    
    return NextResponse.json({
      id: employee.id,
      employeeId: employee.employeeId,
      message: 'Employee created successfully',
      employee,
    })
  } catch (error: any) {
    logger.error('Error creating employee', error, {
      path: '/api/employees',
      method: 'POST',
    })
    
    // Handle specific database errors
    if (error.code === 'P1001') {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 503 }
      )
    }
    
    if (error.code === 'P2002') {
      // Prisma unique constraint error
      return NextResponse.json(
        { error: 'Employee ID or email already exists' },
        { status: 409 }
      )
    }
    
    if (error.code === 'P2003') {
      // Foreign key constraint error
      return NextResponse.json(
        { error: 'Invalid department, position, or site reference' },
        { status: 400 }
      )
    }
    
    // Handle JSON parsing errors
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Gagal membuat karyawan' },
      { status: 500 }
    )
  }
}