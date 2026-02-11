import { NextResponse, NextRequest } from 'next/server'
import { getMikroTikRouterRepository } from '@/lib/repositories'
import { mikrotikRouterCreateSchema } from '@/lib/validations/mikrotik'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import type { MikroTikRouterCreateData } from '@/modules/network/repositories/IMikroTikRouterRepository'

/**
 * @swagger
 * /api/mikrotik-routers:
 *   get:
 *     summary: Get all MikroTik routers
 *     description: Retrieve a list of all MikroTik routers with their configurations
 *     tags: [Network Equipment]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved router list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 routers:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MikroTikRouter'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/Error'
 *
 *   post:
 *     summary: Create a new MikroTik router
 *     description: Add a new MikroTik router to the network management system
 *     tags: [Network Equipment]
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
 *               - name
 *               - ipAddress
 *               - apiUsername
 *               - apiPassword
 *             properties:
 *               name:
 *                 type: string
 *                 description: Router name/identifier
 *                 example: "Router-Main-Office"
 *               ipAddress:
 *                 type: string
 *                 format: ipv4
 *                 description: Router IP address
 *                 example: "192.168.1.1"
 *               timezone:
 *                 type: string
 *                 description: Router timezone configuration
 *                 example: "Asia/Jakarta"
 *               apiPort:
 *                 type: integer
 *                 description: MikroTik API port
 *                 example: 8728
 *               apiUsername:
 *                 type: string
 *                 description: API username for router access
 *                 example: "admin"
 *               apiPassword:
 *                 type: string
 *                 description: API password for router access
 *                 example: "securePassword123"
 *               authPort:
 *                 type: integer
 *                 description: RADIUS authentication port
 *                 example: 1812
 *               accountingPort:
 *                 type: integer
 *                 description: RADIUS accounting port
 *                 example: 1813
 *               secretRadius:
 *                 type: string
 *                 description: RADIUS shared secret
 *                 example: "radiusSecret"
 *               isolirUrl:
 *                 type: string
 *                 description: URL for isolation/blocked page
 *                 example: "http://example.com/blocked"
 *               description:
 *                 type: string
 *                 description: Router description
 *                 example: "Main office router for internal network"
 *     responses:
 *       200:
 *         description: Successfully created router
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: Created router ID
 *                   example: 1
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         description: IP address already exists or conflict occurred
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "IP Address sudah terpakai atau terjadi kesalahan"
 *       500:
 *         $ref: '#/components/responses/Error'
 */
export async function GET(req: NextRequest) {
  try {
    // Cek autentikasi admin menggunakan fungsi terpusat
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
    }

    if (!(await hasPermission("mikrotik:read"))) {
      return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || undefined

    const routerRepository = getMikroTikRouterRepository()

    // RBAC: Check site restrictions
    let siteIdFilter: string | undefined = undefined
    if ((await hasPermission("mikrotik:site_only")) && session.user.role !== 'SUPER_ADMIN') {
        const userSiteId = (session.user as { siteId?: string }).siteId
        if (!userSiteId) {
             // User has site restriction but no site assigned, return empty or error?
             // Returning empty list is safer
             return NextResponse.json({
                routers: [],
                total: 0,
                page,
                limit,
                totalPages: 0
             })
        }
        siteIdFilter = userSiteId
    }

    // Use findWithFilters if pagination params are present, otherwise findAll for backward compatibility if needed
    // But better to always use paginated response for consistency on this route
    const filters: Record<string, string | undefined> = {}
    if (search) filters.search = search
    if (siteIdFilter) filters.siteId = siteIdFilter

    const result = await routerRepository.findWithFilters(
      filters,
      { page, limit }
    )

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('Error fetching MikroTik Routers:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: errorMessage || 'Gagal memuat data Router', routers: [], total: 0, page: 1, limit: 10, totalPages: 0 },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  // Cek autentikasi admin menggunakan fungsi terpusat
  const session = await getServerSession(authOptions)
  if (!session || !session.user) return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })

  if (!(await hasPermission("mikrotik:create"))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }
  const body = await req.json()
  const parsed = mikrotikRouterCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const {
    name,
    ipAddress,
    timezone,
    apiPort,
    apiUsername,
    apiPassword,
    authPort,
    accountingPort,
    secretRadius,
    isolirUrl,
    description,
    siteId,
  } = parsed.data

  // RBAC: Check site restrictions for creation
  let finalSiteId = siteId
  if ((await hasPermission("mikrotik:site_only")) && session.user.role !== 'SUPER_ADMIN') {
       const userSiteId = (session.user as { siteId?: string }).siteId
       if (!userSiteId) {
           return NextResponse.json({ error: 'User tidak memiliki akses site untuk membuat router' }, { status: 403 })
       }
       finalSiteId = userSiteId
  }
  try {
    const routerRepository = getMikroTikRouterRepository()
    // 3. Create Router (Repository)
    // NAS sync happens inside Repository
    const createData: Record<string, string | number | undefined> = {
      name,
      ipAddress,
      apiPort: Number(apiPort),
      apiUsername,
      apiPassword,
      authPort: Number(authPort),
      accountingPort: Number(accountingPort),
      secretRadius,
    }
    if (timezone) createData.timezone = timezone
    if (isolirUrl) createData.isolirUrl = isolirUrl
    if (description) createData.description = description
    if (finalSiteId) createData.siteId = finalSiteId

    const router = await routerRepository.create(createData as unknown as MikroTikRouterCreateData)

    // 4. Auto Provisioning (Optional)
    let provisioningResult = { success: true, logs: [] as string[] };

    if (body.autoConfigure) {
      console.log('Starting Auto Provisioning...');
      try {
        // Wrap import in try-catch to prevent module loading errors from crashing the request
        const serviceModule = await import('@/modules/network/services/MikroTikProvisioningService');
        if (serviceModule && serviceModule.MikroTikProvisioningService) {
            const { MikroTikProvisioningService } = serviceModule;
            const provisioningService = new MikroTikProvisioningService();

            provisioningResult = await provisioningService.provisionRadius(
            {
                ip: ipAddress,
                port: Number(apiPort),
                username: apiUsername,
                password: apiPassword,
            },
            null, // Auto-detect IP
            secretRadius,
            isolirUrl // Pass optional Isolir URL
            );

            if (!provisioningResult.success) {
                console.warn(`Router created but provisioning failed: ${provisioningResult.logs.join(', ')}`);
            }

            // 5. Auto Create API User (setelah provisioning berhasil)
            console.log('Creating API User...');
            const apiUserResult = await provisioningService.createApiUser({
                ip: ipAddress,
                port: Number(apiPort),
                username: apiUsername,
                password: apiPassword,
            });

            if (apiUserResult.success && apiUserResult.username && apiUserResult.password) {
                // Update database dengan generated credentials
                const { prisma } = await import('@/lib/prisma');
                await prisma.mikroTikRouter.update({
                    where: { id: router.id },
                    data: {
                        apiUsernameGenerated: apiUserResult.username,
                        apiPasswordGenerated: apiUserResult.password,
                    }
                });
                console.log(`API User created and saved: ${apiUserResult.username}`);
            } else {
                console.warn(`API User creation failed: ${apiUserResult.logs.join(', ')}`);
            }
        } else {
            console.error('Failed to load MikroTikProvisioningService module');
            provisioningResult = { success: false, logs: ['Internal Error: Could not load provisioning service'] };
        }
      } catch (e: unknown) {
        console.error('Provisioning CRITICAL error:', e);
        // Do not fail the request if provisioning fails, just log it.
        // We still want to return the success response for the Router creation.
        provisioningResult = { success: false, logs: [e instanceof Error ? e.message : 'Unknown provisioning error'] };
      }
    }

    // Trigger initial status check (running in background so response isn't delayed too much,
    // or await it if fast enough. 5s timeout is acceptable for "Add" action)
    try {
      const { checkSingleMikroTikRouterStatus } = await import('@/modules/network/services/mikrotik-ping-check')
      await checkSingleMikroTikRouterStatus(router.id)
    } catch (err) {
      console.error('Failed to perform initial router check:', err)
    }

    // System Log
    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'CREATE',
        subject: 'MikroTik Router',
        userId: session.user.id!,
        details: { id: router.id, name: name, ip: ipAddress }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    return NextResponse.json({ id: router.id })
  } catch (_e: unknown) {
    return NextResponse.json({ error: 'IP Address sudah terpakai atau terjadi kesalahan' }, { status: 409 })
  }
}
