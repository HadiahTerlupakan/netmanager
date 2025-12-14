import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/route-protection'
import { prisma } from '@/lib/prisma'
import { employeeUpdateSchema } from '@/lib/validations/employee'
import { logger } from '@/lib/logger'

/**
 * @swagger
 * /api/employees/{id}:
 *   get:
 *     summary: Get employee by ID
 *     description: Mengambil detail karyawan berdasarkan ID
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Employee ID
 *     responses:
 *       200:
 *         description: Detail karyawan berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 employee:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     employeeId:
 *                       type: string
 *                     fullName:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     departmentId:
 *                       type: string
 *                     positionId:
 *                       type: string
 *                     siteId:
 *                       type: string
 *                     joinDate:
 *                       type: string
 *                       format: date-time
 *                     status:
 *                       type: string
 *                     isActive:
 *                       type: boolean
 *                     department:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                     position:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         title:
 *                           type: string
 *                         level:
 *                           type: string
 *                     site:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         code:
 *                           type: string
 *                         name:
 *                           type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Employee not found
 *       500:
 *         description: Server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  
  // Check authentication
  const authError = await requireAuth(request)
  if (authError) return authError
  
  const { id } = await params
    const { provider } = await params
  
  try {
    const employee = await prisma.employee.findUnique({
      where: { id },
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
    
    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }
    
    logger.apiRequest('GET', `/api/employees/${id}`, 200, Date.now() - startTime, {
      employeeId: id,
    })
    
    return NextResponse.json({ employee })
  } catch (error: any) {
    logger.error('Error fetching employee', error, {
      path: `/api/employees/${id}`,
      method: 'GET',
    })
    
    return NextResponse.json(
      { error: 'Gagal memuat data karyawan' },
      { status: 500 }
    )
  }
}

/**
 * @swagger
 * /api/employees/{id}:
 *   put:
 *     summary: Update employee
 *     description: Mengupdate data karyawan
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Employee ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               employeeId:
 *                 type: string
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               departmentId:
 *                 type: string
 *               positionId:
 *                 type: string
 *               siteId:
 *                 type: string
 *               joinDate:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE, ON_LEAVE, TERMINATED]
 *               isActive:
 *                 type: boolean
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
 *         description: Karyawan berhasil diupdate
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
 *       404:
 *         description: Employee not found
 *       409:
 *         description: Employee ID or email already exists
 *       500:
 *         description: Server error
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  
  // Check authentication
  const authError = await requireAuth(request)
  if (authError) return authError
  
  const { id } = await params
    const { provider } = await params
  
  try {
    // Check if employee exists
    const existingEmployee = await prisma.employee.findUnique({
      where: { id },
    })
    
    if (!existingEmployee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }
    
    const body = await request.json()
    const parsed = employeeUpdateSchema.parse(body)
    
    // Check if employee ID already exists (if being updated)
    if (parsed.employeeId && parsed.employeeId !== existingEmployee.employeeId) {
      const duplicateEmployeeId = await prisma.employee.findUnique({
        where: { employeeId: parsed.employeeId },
      })
      
      if (duplicateEmployeeId) {
        return NextResponse.json(
          { error: 'Employee ID already exists' },
          { status: 409 }
        )
      }
    }
    
    // Check if email already exists (if being updated)
    if (parsed.email && parsed.email !== existingEmployee.email) {
      const duplicateEmail = await prisma.employee.findUnique({
        where: { email: parsed.email },
      })
      
      if (duplicateEmail) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 409 }
        )
      }
    }
    
    // Get session for updatedBy
    const session = await requireAuth(request)
    
    // Update employee
    const employee = await prisma.employee.update({
      where: { id },
      data: {
        ...parsed,
        updatedBy: (session as any)?.user?.id,
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
    
    logger.apiRequest('PUT', `/api/employees/${id}`, 200, Date.now() - startTime, {
      employeeId: id,
      updatedBy: (session as any)?.user?.id,
    })
    
    return NextResponse.json({
      id: employee.id,
      employeeId: employee.employeeId,
      message: 'Employee updated successfully',
      employee,
    })
  } catch (error: any) {
    logger.error('Error updating employee', error, {
      path: `/api/employees/${id}`,
      method: 'PUT',
    })
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: error.errors },
        { status: 400 }
      )
    }
    
    if (error.code === 'P2002') {
      // Prisma unique constraint error
      return NextResponse.json(
        { error: 'Employee ID or email already exists' },
        { status: 409 }
      )
    }
    
    return NextResponse.json(
      { error: 'Gagal mengupdate karyawan' },
      { status: 500 }
    )
  }
}

/**
 * @swagger
 * /api/employees/{id}:
 *   delete:
 *     summary: Delete employee
 *     description: Menghapus karyawan
 *     tags: [Employees]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Employee ID
 *     responses:
 *       200:
 *         description: Karyawan berhasil dihapus
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Employee not found
 *       500:
 *         description: Server error
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  
  // Check authentication
  const authError = await requireAuth(request)
  if (authError) return authError
  
  const { id } = await params
    const { provider } = await params
  
  try {
    // Check if employee exists
    const existingEmployee = await prisma.employee.findUnique({
      where: { id },
    })
    
    if (!existingEmployee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }
    
    // Check if employee has related records
    const workOrdersCount = await prisma.workOrder.count({
      where: {
        OR: [
          { createdById: id },
          { assignedToId: id },
        ],
      },
    })
    
    if (workOrdersCount > 0) {
      return NextResponse.json(
        { 
          error: 'Cannot delete employee with related work orders',
          details: `Employee has ${workOrdersCount} related work orders`
        },
        { status: 400 }
      )
    }
    
    // Delete employee
    await prisma.employee.delete({
      where: { id },
    })
    
    logger.apiRequest('DELETE', `/api/employees/${id}`, 200, Date.now() - startTime, {
      employeeId: id,
    })
    
    return NextResponse.json({
      success: true,
      message: 'Employee deleted successfully',
    })
  } catch (error: any) {
    logger.error('Error deleting employee', error, {
      path: `/api/employees/${id}`,
      method: 'DELETE',
    })
    
    return NextResponse.json(
      { error: 'Gagal menghapus karyawan' },
      { status: 500 }
    )
  }
}