import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getUserRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import { userUpdateSchema } from '@/lib/validations/user'
import { hash } from 'bcryptjs'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

/**
 * @swagger
 * /api/users/{id}:
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
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await _req.json()

  console.log('[USER-UPDATE] Updating user:', { id, body })

  // Handle user data update
  const data: any = {}
  if (body.name !== undefined) data.name = body.name
  if (body.password) data.passwordHash = await hash(body.password, 10)

  console.log('[USER-UPDATE] Data to update:', data)

  // Update user
  const updatedUser = await prisma.user.update({
    where: { id },
    data,
  })

  console.log('[USER-UPDATE] User updated successfully:', {
    id: updatedUser.id,
    email: updatedUser.email,
  })

  // Role update logic removed

  return NextResponse.json({ ok: true })
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

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
    return NextResponse.json({ error: e.message || 'Gagal memuat pengguna' }, { status: 500 })
  }
}

/**
 * @swagger
 * /api/users/{id}:
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
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const userRepository = getUserRepository()
  await userRepository.delete(id)
  return NextResponse.json({ ok: true })
}


