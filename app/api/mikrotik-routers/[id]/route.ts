import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { hasPermission } from '@/lib/rbac'
import { getMikroTikRouterRepository } from '@/lib/repositories'
import { mikrotikRouterUpdateSchema } from '@/lib/validations/mikrotik'

/**
 * @swagger
 * /api/mikrotik-routers/{id}:
 *   get:
 *     summary: Get MikroTik router by ID
 *     description: Retrieve detailed information about a specific MikroTik router
 *     tags: [MikroTik]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Router ID
 *     responses:
 *       200:
 *         description: Router details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 router:
 *                   $ref: '#/components/schemas/MikroTikRouter'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Router not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Router tidak ditemukan"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Gagal memuat data Router"
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin(req)
    if (session instanceof NextResponse) return session
    const { id } = await params
    const routerRepository = getMikroTikRouterRepository()
    const router = await routerRepository.findById(id)
    if (!router) {
      return NextResponse.json({ error: 'Router tidak ditemukan' }, { status: 404 })
    }

    if ((await hasPermission("mikrotik:site_only")) && session.user.role !== 'SUPER_ADMIN') {
        const userSiteId = (session.user as { siteId?: string }).siteId
        if (!userSiteId || router.siteId !== userSiteId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
    }

    return NextResponse.json({ router })
  } catch (error: unknown) {
    console.error('Error fetching MikroTik Router:', error)
    const errorMessage = error instanceof Error ? error.message : 'Gagal memuat data Router'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

/**
 * @swagger
 * /api/mikrotik-routers/{id}:
 *   patch:
 *     summary: Update MikroTik router
 *     description: Update configuration of a specific MikroTik router
 *     tags: [MikroTik]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Router ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Router name
 *               ipAddress:
 *                 type: string
 *                 format: ipv4
 *                 description: Router IP address
 *               timezone:
 *                 type: string
 *                 description: Router timezone
 *               apiPort:
 *                 type: integer
 *                 description: API port number
 *               apiUsername:
 *                 type: string
 *                 description: API username
 *               apiPassword:
 *                 type: string
 *                 description: API password
 *               authPort:
 *                 type: integer
 *                 description: Authentication port
 *               accountingPort:
 *                 type: integer
 *                 description: Accounting port
 *               secretRadius:
 *                 type: string
 *                 description: RADIUS secret
 *               isolirUrl:
 *                 type: string
 *                 nullable: true
 *                 description: Isolation URL
 *               description:
 *                 type: string
 *                 nullable: true
 *                 description: Router description
 *     responses:
 *       200:
 *         description: Router updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Bad request - validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: object
 *                   description: Validation error details
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Conflict - IP address already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Gagal mengupdate router atau IP Address sudah terpakai"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req)
  if (session instanceof NextResponse) return session
  const { id } = await params
  const json = await req.json()
  const parsed = mikrotikRouterUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data
  try {
    const routerRepository = getMikroTikRouterRepository()

    // Check ownership before update
    const existingRouter = await routerRepository.findById(id)
    if (!existingRouter) {
        return NextResponse.json({ error: 'Router tidak ditemukan' }, { status: 404 })
    }

    if ((await hasPermission("mikrotik:site_only")) && session.user.role !== 'SUPER_ADMIN') {
        const userSiteId = (session.user as { siteId?: string }).siteId
        if (!userSiteId || existingRouter.siteId !== userSiteId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        // Force siteId to remain unchanged or set to user's site
        data.siteId = userSiteId
    }

    const updateData: Record<string, unknown> = {}
    if (data.name) updateData.name = data.name
    if (data.ipAddress) updateData.ipAddress = data.ipAddress
    if (data.timezone !== undefined) updateData.timezone = data.timezone
    if (data.apiPort !== undefined) updateData.apiPort = data.apiPort
    if (data.apiUsername !== undefined) updateData.apiUsername = data.apiUsername
    if (data.apiPassword !== undefined) updateData.apiPassword = data.apiPassword
    if (data.authPort !== undefined) updateData.authPort = data.authPort
    if (data.accountingPort !== undefined) updateData.accountingPort = data.accountingPort
    if (data.secretRadius !== undefined) updateData.secretRadius = data.secretRadius
    if (data.isolirUrl !== undefined) updateData.isolirUrl = data.isolirUrl
    if (data.description !== undefined) updateData.description = data.description
    if (data.siteId !== undefined) updateData.siteId = data.siteId

    await routerRepository.update(id, updateData)

    // System Log
    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'UPDATE',
        subject: 'MikroTik Router',
        userId: session.user.id!,
        details: { id, changes: data }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    return NextResponse.json({ success: true })
  } catch (_e: unknown) {
    return NextResponse.json({ error: 'Gagal mengupdate router atau IP Address sudah terpakai' }, { status: 409 })
  }
}

/**
 * @swagger
 * /api/mikrotik-routers/{id}:
 *   delete:
 *     summary: Delete MikroTik router
 *     description: Remove a MikroTik router from the system
 *     tags: [MikroTik]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Router ID
 *     responses:
 *       200:
 *         description: Router deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Gagal menghapus router"
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(req)
  if (session instanceof NextResponse) return session
  try {
    const { id } = await params
    const routerRepository = getMikroTikRouterRepository()
    
    // 1. Get Router Details for Deprovisioning
    const router = await routerRepository.findById(id)
    
    if (router) {
         if ((await hasPermission("mikrotik:site_only")) && session.user.role !== 'SUPER_ADMIN') {
            const userSiteId = (session.user as { siteId?: string }).siteId
            if (!userSiteId || router.siteId !== userSiteId) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
            }
        }
         // Auto Deprovisioning
         try {
            // Lazy load service
            const { MikroTikProvisioningService } = await import('@/modules/network/services/MikroTikProvisioningService');
            const provisioningService = new MikroTikProvisioningService();
            
            console.log(`Deprovisioning router ${router.ipAddress}...`);
            const result = await provisioningService.deprovisionRadius(
                {
                    ip: router.ipAddress,
                    port: router.apiPort,
                    username: router.apiUsername,
                    password: router.apiPassword,
                },
                null, // Auto-detect IP to remove
                router.isolirUrl // Pass isolirUrl for cleanup
            );
            if (!result.success) {
                console.warn(`Deprovisioning failed: ${result.logs.join(', ')}`);
            } else {
                console.log(`Deprovisioning success: ${result.logs.join(', ')}`);
            }
         } catch (e) {
             console.error('Failed to auto-deprovision:', e);
             // Continue deletion anyway
         }
    }

    await routerRepository.delete(id)

    // System Log
    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'DELETE',
        subject: 'MikroTik Router',
        userId: session.user.id,
        details: { id }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    return NextResponse.json({ success: true })
  } catch (_e: unknown) {
    return NextResponse.json({ error: 'Gagal menghapus router' }, { status: 500 })
  }
}

