// Cleaned up file content
import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { getUserPermissions } from '@/lib/auth'
import { getUserRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import { hash } from 'bcryptjs'
import { logger } from '@/lib/logger'
import { checkSiteRestriction, canAccessSite } from '@/lib/site-restriction'

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
 *               phone:
 *                 type: string
 *                 nullable: true
 *               isActive:
 *                 type: boolean
 *               departmentId:
 *                 type: string
 *                 nullable: true
 *               siteId:
 *                 type: string
 *                 nullable: true
 *               roleId:
 *                 type: string
 *                 nullable: true
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
  if (body.roleId !== undefined) data.roleId = body.roleId || null
  if (body.isActive !== undefined) data.isActive = body.isActive

  // Working Hours
  if (body.workingHourMode !== undefined) data.workingHourMode = body.workingHourMode
  if (body.startWorkTime !== undefined) data.startWorkTime = body.startWorkTime
  if (body.endWorkTime !== undefined) data.endWorkTime = body.endWorkTime
  if (body.workDays !== undefined) data.workDays = body.workDays
  if (body.flexibleTargetHour !== undefined) data.flexibleTargetHour = body.flexibleTargetHour
  if (body.shiftId !== undefined) data.shiftId = body.shiftId
  if (body.canvasingTarget !== undefined) data.canvasingTarget = parseInt(body.canvasingTarget) || 50
  if (body.isSales !== undefined) data.isSales = body.isSales

  console.log('[USER-UPDATE] Data to update:', data)

  try {
    // Check permissions
    const permissions = await getUserPermissions(session.user.id)
    const isSelfUpdate = session.user.id === id
    
    if (!permissions.includes('users:update')) {
      return NextResponse.json({ error: 'Unauthorized: You do not have permission to update users.' }, { status: 403 })
    }

    // Check if we need to validate sensitive field changes
    const hasSensitiveFields = body.roleId !== undefined || body.siteId !== undefined || 
                              body.departmentId !== undefined || body.isActive !== undefined;
    
    let currentData = null;
    if (hasSensitiveFields) {
        currentData = await prisma.user.findUnique({
            where: { id },
            select: { roleId: true, siteId: true, departmentId: true, isActive: true }
        });
    }

    // IDOR Protection: Prevent self-update of sensitive fields
    if (isSelfUpdate && currentData) {
        if (body.roleId !== undefined && body.roleId !== currentData.roleId) {
          console.warn('[USER-UPDATE] SECURITY: Self role change attempt blocked', { userId: id, old: currentData.roleId, new: body.roleId })
          return NextResponse.json({ error: 'Unauthorized: Cannot change your own role' }, { status: 403 })
        }
        if (body.siteId !== undefined && body.siteId !== currentData.siteId) {
          console.warn('[USER-UPDATE] SECURITY: Self site change attempt blocked', { userId: id })
          return NextResponse.json({ error: 'Unauthorized: Cannot change your own site assignment' }, { status: 403 })
        }
        if (body.departmentId !== undefined && body.departmentId !== currentData.departmentId) {
          console.warn('[USER-UPDATE] SECURITY: Self department change attempt blocked', { userId: id })
          return NextResponse.json({ error: 'Unauthorized: Cannot change your own department' }, { status: 403 })
        }
        if (body.isActive !== undefined && body.isActive !== currentData.isActive) {
          console.warn('[USER-UPDATE] SECURITY: Self status change attempt blocked', { userId: id })
          return NextResponse.json({ error: 'Unauthorized: Cannot change your own active status' }, { status: 403 })
        }
    }

    // Granular Permission Checks for sensitive operations
    // Only require granular permissions if the value is ACTUALLY changing
    if (!isSelfUpdate) {
      if (body.roleId !== undefined && (!currentData || body.roleId !== currentData.roleId) && !permissions.includes('users:update:role')) {
        console.warn('[USER-UPDATE] Missing granular permission: users:update:role', { userId: session.user.id })
        return NextResponse.json({ error: 'Unauthorized: You do not have permission to change user roles' }, { status: 403 })
      }
      if (body.siteId !== undefined && (!currentData || body.siteId !== currentData.siteId) && !permissions.includes('users:update:site')) {
        console.warn('[USER-UPDATE] Missing granular permission: users:update:site', { userId: session.user.id })
        return NextResponse.json({ error: 'Unauthorized: You do not have permission to change user site assignments' }, { status: 403 })
      }
      if (body.departmentId !== undefined && (!currentData || body.departmentId !== currentData.departmentId) && !permissions.includes('users:update:department')) {
        console.warn('[USER-UPDATE] Missing granular permission: users:update:department', { userId: session.user.id })
        return NextResponse.json({ error: 'Unauthorized: You do not have permission to change user departments' }, { status: 403 })
      }
      if (body.isActive !== undefined && (!currentData || body.isActive !== currentData.isActive) && !permissions.includes('users:update:status')) {
        console.warn('[USER-UPDATE] Missing granular permission: users:update:status', { userId: session.user.id })
        return NextResponse.json({ error: 'Unauthorized: You do not have permission to enable/disable users' }, { status: 403 })
      }
    }

    // Site restriction check using centralized helper
    const { isRestricted, siteId: userSiteId } = checkSiteRestriction(session, 'users')

    if (isRestricted && !isSelfUpdate) {
      // Fetch target user to check their site
      const targetUser = await prisma.user.findUnique({
        where: { id },
        select: { siteId: true }
      })

      if (!targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      if (!canAccessSite(session, 'users', targetUser.siteId)) {
        return NextResponse.json({ error: 'Unauthorized: You can only update users within your assigned site.' }, { status: 403 })
      }

      // Also prevent changing siteId to something else
      if (data.siteId && data.siteId !== userSiteId) {
        return NextResponse.json({ error: 'Unauthorized: You cannot change user site to a different site.' }, { status: 403 })
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data,
    })

    // Invalidate permission cache if role changed
    if (body.roleId !== undefined) {
      const { invalidatePermissionCache } = await import('@/lib/auth')
      await invalidatePermissionCache(id)
      console.debug('[USER-UPDATE] Permission cache invalidated due to role change', { userId: id })
    }

    console.log('[USER-UPDATE] User updated successfully:', {
      id: updatedUser.id,
      email: updatedUser.email,
    })

    await logger.logActivity({
      action: 'UPDATE',
      subject: 'User',
      userId: session.user.id,
      details: { id: updatedUser.id, changes: Object.keys(data) }
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
 *                     roleId:
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
 *                     role:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
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
        roleId: true,
        workingHourMode: true,
        startWorkTime: true,
        endWorkTime: true,
        workDays: true,
        flexibleTargetHour: true,
        canvasingTarget: true,
        isSales: true,
        shiftId: true,
        departments: {
          select: { id: true, name: true },
        },
        sites: {
          select: { id: true, code: true, name: true },
        },
        role: {
          select: { id: true, name: true },
        },
      },
    })

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    // Check permissions
    const permissions = await getUserPermissions(session.user.id)
    const isSelfView = session.user.id === id

    if (!permissions.includes('users:read') && !isSelfView) {
      return NextResponse.json({ error: 'Unauthorized: You do not have permission to view users.' }, { status: 403 })
    }

    // Site restriction check using centralized helper
    if (!isSelfView && !canAccessSite(session, 'users', user.siteId)) {
      return NextResponse.json({ error: 'Unauthorized: You can only view users within your assigned site.' }, { status: 403 })
    }

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

    // Check permissions
    const permissions = await getUserPermissions(session.user.id)
    if (!permissions.includes('users:delete')) {
      return NextResponse.json({ error: 'Unauthorized: You do not have permission to delete users.' }, { status: 403 })
    }

    // Site restriction check using centralized helper
    if (checkSiteRestriction(session, 'users').isRestricted) {
      const targetUser = await prisma.user.findUnique({
        where: { id },
        select: { siteId: true }
      })

      if (!targetUser) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      if (!canAccessSite(session, 'users', targetUser.siteId)) {
        return NextResponse.json({ error: 'Unauthorized: You can only delete users within your assigned site.' }, { status: 403 })
      }
    }

    await userRepository.delete(id)

    await logger.logActivity({
      action: 'DELETE',
      subject: 'User',
      userId: session.user.id,
      details: { id }
    })

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
