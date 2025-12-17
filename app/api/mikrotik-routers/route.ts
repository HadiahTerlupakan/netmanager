import { NextResponse, NextRequest } from 'next/server'
import { getMikroTikRouterRepository } from '@/lib/repositories'
import { mikrotikRouterCreateSchema } from '@/lib/validations/mikrotik'
import { requireAdmin } from '@/lib/auth-helpers'

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
    const session = await requireAdmin(req)
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || undefined

    const routerRepository = getMikroTikRouterRepository()

    // Use findWithFilters if pagination params are present, otherwise findAll for backward compatibility if needed
    // But better to always use paginated response for consistency on this route
    const result = await routerRepository.findWithFilters(
      { search },
      { page, limit }
    )

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error fetching MikroTik Routers:', error)
    const errorMessage = error?.message || error?.toString() || 'Gagal memuat data Router'
    return NextResponse.json(
      { error: errorMessage, routers: [], total: 0, page: 1, limit: 10, totalPages: 0 },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  // Cek autentikasi admin menggunakan fungsi terpusat
  const session = await requireAdmin(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const json = await req.json()
  const parsed = mikrotikRouterCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data
  try {
    const routerRepository = getMikroTikRouterRepository()
    const router = await routerRepository.create({
      name: data.name,
      ipAddress: data.ipAddress,
      timezone: data.timezone,
      apiPort: data.apiPort,
      apiUsername: data.apiUsername,
      apiPassword: data.apiPassword,
      authPort: data.authPort,
      accountingPort: data.accountingPort,
      secretRadius: data.secretRadius,
      isolirUrl: data.isolirUrl,
      description: data.description,
    })

    // Trigger initial status check (running in background so response isn't delayed too much, 
    // or await it if fast enough. 5s timeout is acceptable for "Add" action)
    try {
      const { checkSingleMikroTikRouterStatus } = await import('@/lib/services/mikrotik-ping-check')
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
        userId: session.user.id,
        details: { id: router.id, name: data.name, ip: data.ipAddress }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    return NextResponse.json({ id: router.id })
  } catch (e: any) {
    return NextResponse.json({ error: 'IP Address sudah terpakai atau terjadi kesalahan' }, { status: 409 })
  }
}
```
