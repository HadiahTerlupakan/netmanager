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
  const data: Record<string, unknown> = {}
  if (body.name !== undefined) data.name = body.name
  if (body.password) data.passwordHash = await hash(body.password, 10)
  if (body.phone !== undefined) data.phone = body.phone || null
  if (body.departmentId !== undefined) data.departmentId = body.departmentId || null
  if (body.siteId !== undefined) data.siteId = body.siteId || null
  if (body.isActive !== undefined) data.isActive = body.isActive

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
 *                     phone:
 *                       type: string
 *                       nullable: true
 *                       example: +62812345678
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *                     departmentId:
 *                       type: string
 *                       nullable: true
 *                     siteId:
 *                       type: string
 *                       nullable: true
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     department:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                     site:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: string
 *                         code:
 *                           type: string
 *                         name:
 *                           type: string
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
    // Fetch user with related data
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
        departmentId: true,
        siteId: true,
        department: {
          select: { id: true, name: true },
        },
        site: {
          select: { id: true, code: true, name: true },
        },
      },
    })

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    return NextResponse.json({ user })
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
