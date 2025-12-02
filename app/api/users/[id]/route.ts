import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getUserRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import { userUpdateSchema } from '@/lib/validations/user'
import { hash } from 'bcryptjs'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || session?.user?.role !== 'ADMIN') {
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
 *               role:
 *                 type: string
 *                 enum: [USER, ADMIN]
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
  const parsed = userUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const userRepository = getUserRepository()
  const data: any = {}
  if (parsed.data.name !== undefined) data.name = parsed.data.name
  if (parsed.data.role !== undefined) data.role = parsed.data.role
  if (parsed.data.password) data.passwordHash = await hash(parsed.data.password, 10)

  await userRepository.update(id, data)
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
        role: true,
        createdAt: true,
      },
    })

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Fetch linked employee if exists
    const emp = await prisma.employee.findFirst({
      where: { userId: id },
      include: {
        department: {
          select: { id: true, name: true },
        },
        position: {
          select: { id: true, title: true },
        },
      },
    })

    const employee = emp
      ? {
          id: emp.id,
          employeeId: emp.employeeId,
          department: emp.department,
          position: emp.position,
          employmentStatus: emp.employmentStatus,
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


