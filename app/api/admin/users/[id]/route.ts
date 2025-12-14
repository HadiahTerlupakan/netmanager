// Cleaned up file content
import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { getUserRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'

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
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    )
  }

  console.log('[USER-UPDATE] Updating user:', { id, body })

  // Validate input
  if (body.name !== undefined && typeof body.name !== 'string') {
    return NextResponse.json(
      { error: 'Name must be a string' },
      { status: 400 }
    )
  }
  
  if (body.password !== undefined) {
    if (typeof body.password !== 'string' || body.password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      )
    }
  }

  // Handle user data update
  const data: any = {}
  if (body.name !== undefined) data.name = body.name
  if (body.password) data.passwordHash = await hash(body.password, 10)

  console.log('[USER-UPDATE] Data to update:', data)

  try {
    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data,
    })

    console.log('[USER-UPDATE] User updated successfully:', {
      id: updatedUser.id,
      email: updatedUser.email,
    })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('[USER-UPDATE] Error updating user:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
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
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     employee:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: string
 *                         employeeId:
 *                           type: string
 *                         fullName:
 *                           type: string
 *                         email:
 *                           type: string
 *                         phone:
 *                           type: string
 *                         departmentId:
 *                           type: string
 *                         positionId:
 *                           type: string
 *                         siteId:
 *                           type: string
 *                         joinDate:
 *                           type: string
 *                           format: date-time
 *                         status:
 *                           type: string
 *                         department:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             name:
 *                               type: string
 *                         position:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             title:
 *                               type: string
 *                         site:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             code:
 *                               type: string
 *                             name:
 *                               type: string
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
    return NextResponse.json(
      { error: 'Invalid user ID' },
      { status: 400 }
    )
  }
  
  try {
    // Fetch user
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    })

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Fetch linked employee if exists with all fields needed for edit form
    const emp = await prisma.employee.findFirst({
      where: { userId: id },
      include: {
        department: {
          select: { id: true, name: true },
        },
        position: {
          select: { id: true, title: true },
        },
        site: {
          select: { id: true, code: true, name: true },
        },
      },
    })

    const employee = emp
      ? {
        id: emp.id,
        employeeId: emp.employeeId,
        fullName: emp.fullName,
        email: emp.email,
        phone: emp.phone,
        departmentId: emp.departmentId,
        positionId: emp.positionId,
        siteId: emp.siteId,
        joinDate: emp.joinDate,
        status: emp.status,
        department: emp.department,
        position: emp.position,
        site: emp.site,
        // Personal Information
        dateOfBirth: emp.dateOfBirth,
        gender: emp.gender,
        idCardNumber: emp.idCardNumber,
        address: emp.address,
        city: emp.city,
        province: emp.province,
        // Employment Details
        employmentStatus: emp.employmentStatus,
        probationEndDate: emp.probationEndDate,
        // Bank Information
        bankName: emp.bankName,
        bankAccountNumber: emp.bankAccountNumber,
        bankAccountName: emp.bankAccountName,
        npwp: emp.npwp,
        // Emergency Contact
        emergencyName: emp.emergencyName,
        emergencyPhone: emp.emergencyPhone,
        emergencyRelation: emp.emergencyRelation,
      }
      : null

    return NextResponse.json({ user: { ...user, employee } })
  } catch (e: any) {
    console.error('[USER-GET] Error fetching user:', e)
    
    // Handle specific database errors
    if (e.code === 'P1001') {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 503 }
      )
    }
    
    if (e.code === 'P2002') {
      return NextResponse.json(
        { error: 'Database constraint violation' },
        { status: 409 }
      )
    }
    
    return NextResponse.json({ error: e.message || 'Gagal memuat pengguna' }, { status: 500 })
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
    return NextResponse.json(
      { error: 'Invalid user ID' },
      { status: 400 }
    )
  }
  
  try {
    const userRepository = getUserRepository()
    await userRepository.delete(id)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('[USER-DELETE] Error deleting user:', error)
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}
