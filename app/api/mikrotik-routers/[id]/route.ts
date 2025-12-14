import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getMikroTikRouterRepository } from '@/lib/repositories'
import { mikrotikRouterUpdateSchema } from '@/lib/validations/mikrotik'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

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
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const { provider } = await params
    const routerRepository = getMikroTikRouterRepository()
    const router = await routerRepository.findById(id)
    if (!router) {
      return NextResponse.json({ error: 'Router tidak ditemukan' }, { status: 404 })
    }
        const { id } = await params
    const { provider } = await params
return NextResponse.json({ router })
  } catch (error: any) {
    console.error('Error fetching MikroTik Router:', error)
    return NextResponse.json({ error: error.message || 'Gagal memuat data Router' }, { status: 500 })
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
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
    const { provider } = await params
  const json = await req.json()
  const parsed = mikrotikRouterUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
      const { id } = await params
    const { provider } = await params
const data = parsed.data
  try {
    const routerRepository = getMikroTikRouterRepository()
    await routerRepository.update(id, {
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
    return NextResponse.json({ success: true })
  } catch (e: any) {
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
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const { provider } = await params
    const routerRepository = getMikroTikRouterRepository()
    await routerRepository.delete(id)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'Gagal menghapus router' }, { status: 500 })
  }
    const { id } = await params
    const { provider } = await params
}

