import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOtbRepository } from '@/lib/repositories'
import { otbCreateSchema } from '@/lib/validations/otb'

/**
 * @swagger
 * /api/otbs:
 *   get:
 *     summary: Get all OTB (Optical Transfer Box) records
 *     description: Retrieve a list of all OTB records with their cores and configurations
 *     tags: [FTTH Infrastructure]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved OTB records
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 otbs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Otb'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/Error'
 *
 *   post:
 *     summary: Create a new OTB (Optical Transfer Box)
 *     description: Create a new OTB record with cores configuration for FTTH network infrastructure
 *     tags: [FTTH Infrastructure]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - coreCount
 *             properties:
 *               name:
 *                 type: string
 *                 description: OTB name/identifier
 *                 example: "OTB-001"
 *               location:
 *                 type: string
 *                 description: Physical location of OTB
 *                 example: "Jl. Sudirman No. 123"
 *               coreCount:
 *                 type: integer
 *                 description: Number of cores in the OTB
 *                 example: 12
 *               notes:
 *                 type: string
 *                 description: Additional notes about OTB
 *                 example: "Main distribution point for area A"
 *               keteranganJumlahKabelFeeder:
 *                 type: string
 *                 description: Description of feeder cables
 *                 example: "4 x 12 core cables"
 *               latitude:
 *                 type: number
 *                 format: float
 *                 description: Latitude coordinate
 *                 example: -6.2088
 *               longitude:
 *                 type: number
 *                 format: float
 *                 description: Longitude coordinate
 *                 example: 106.8456
 *               cores:
 *                 type: array
 *                 description: Core configurations
 *                 items:
 *                   type: object
 *                   required:
 *                     - idx
 *                     - slotName
 *                     - tubeColor
 *                     - coreColor
 *                   properties:
 *                     idx:
 *                       type: integer
 *                       description: Core index
 *                       example: 1
 *                     slotName:
 *                       type: string
 *                       description: Slot name/identifier
 *                       example: "Slot-1"
 *                     tubeColor:
 *                       type: string
 *                       description: Tube color identifier
 *                       example: "Blue"
 *                     coreColor:
 *                       type: string
 *                       description: Core color identifier
 *                       example: "Red"
 *     responses:
 *       200:
 *         description: Successfully created OTB
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: Created OTB ID
 *                   example: 1
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/Error'
 */

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const repo = getOtbRepository()
  const otbs = await repo.findAll()
  return NextResponse.json({ otbs })
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const json = await req.json()
  const parsed = otbCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data
  const repo = getOtbRepository()
  const created = await repo.create({
    name: data.name,
    location: data.location ?? null,
    coreCount: data.coreCount,
    notes: data.notes ?? null,
    keteranganJumlahKabelFeeder: data.keteranganJumlahKabelFeeder ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    cores: data.cores?.map((c: any) => ({
      idx: c.idx,
      slotName: c.slotName,
      tubeColor: c.tubeColor,
      coreColor: c.coreColor,
    })),
  })

  // System Log
  try {
    const { logger } = await import('@/lib/logger')
    await logger.logActivity({
      action: 'CREATE',
      subject: 'OTB',
      userId: session.user.id,
      details: { id: created.id, name: parsed.data.name }
    })
  } catch (e) {
    console.error('Logging failed', e)
  }

  return NextResponse.json({ id: created.id })
}
