import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getMikroTikRouterRepository } from '@/lib/repositories'
import { mikrotikRouterCreateSchema } from '@/lib/validations/mikrotik'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

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
export async function GET() {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const routerRepository = getMikroTikRouterRepository()
    const routers = await routerRepository.findAll()
    return NextResponse.json({ routers })
  } catch (error: any) {
    console.error('Error fetching MikroTik Routers:', error)
    const errorMessage = error?.message || error?.toString() || 'Gagal memuat data Router'
    return NextResponse.json(
      { error: errorMessage, routers: [] },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const session = await requireAdmin()
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
    return NextResponse.json({ id: router.id })
  } catch (e: any) {
    return NextResponse.json({ error: 'IP Address sudah terpakai atau terjadi kesalahan' }, { status: 409 })
  }
}

