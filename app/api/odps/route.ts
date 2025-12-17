import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOdpRepository } from '@/lib/repositories'
import { odpCreateSchema } from '@/lib/validations/odp'

/**
 * @swagger
 * /api/odps:
 *   get:
 *     summary: Get all ODP (Optical Distribution Point) records
 *     description: Retrieve a list of all ODP records with their outputs and configurations
 *     tags: [FTTH Infrastructure]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved ODP records
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 odps:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Odp'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/Error'
 *
 *   post:
 *     summary: Create a new ODP (Optical Distribution Point)
 *     description: Create a new ODP record with outputs configuration for FTTH network infrastructure
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
 *               - odcOutputId
 *             properties:
 *               name:
 *                 type: string
 *                 description: ODP name/identifier
 *                 example: "ODP-001"
 *               location:
 *                 type: string
 *                 description: Physical location of ODP
 *                 example: "Jl. Sudirman No. 789"
 *               notes:
 *                 type: string
 *                 description: Additional notes about ODP
 *                 example: "Final distribution point for residential area"
 *               keteranganJumlahKabelFeeder:
 *                 type: string
 *                 description: Description of feeder cables
 *                 example: "1 x 12 core drop cable"
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
 *               odcOutputId:
 *                 type: integer
 *                 description: Reference to ODC output ID
 *                 example: 1
 *               outputs:
 *                 type: array
 *                 description: Output configurations for customer connections
 *                 items:
 *                   type: object
 *                   required:
 *                     - slotName
 *                     - tubeColor
 *                     - coreColor
 *                   properties:
 *                     idx:
 *                       type: integer
 *                       description: Output index
 *                       example: 1
 *                     slotName:
 *                       type: string
 *                       description: Slot name/identifier
 *                       example: "Port-01"
 *                     redaman:
 *                       type: number
 *                       format: float
 *                       description: Attenuation/loss value in dB
 *                       example: 0.2
 *                     tubeColor:
 *                       type: string
 *                       description: Tube color identifier
 *                       example: "Green"
 *                     coreColor:
 *                       type: string
 *                       description: Core color identifier
 *                       example: "Blue"
 *     responses:
 *       200:
 *         description: Successfully created ODP
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: Created ODP ID
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
  const repo = getOdpRepository()
  const odps = await repo.findAll()
  return NextResponse.json({ odps })
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const json = await req.json()
  const parsed = odpCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data
  const repo = getOdpRepository()
  const created = await repo.create({
    name: data.name,
    location: data.location ?? null,
    notes: data.notes ?? null,
    keteranganJumlahKabelFeeder: data.keteranganJumlahKabelFeeder ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    odcOutputId: data.odcOutputId,
    outputs: data.outputs?.map((o, idx) => ({
      idx: o.idx ?? idx,
      slotName: o.slotName,
      redaman: o.redaman ?? null,
      tubeColor: o.tubeColor,
      coreColor: o.coreColor,
    })),
  })
  // System Log
  try {
    const { logger } = await import('@/lib/logger')
    // Get session again or reuse if available (POST in route.ts doesn't explicitly get session in the viewed snippet, wait)
    // Looking at odps/route.ts in view_file Step 357, I don't see `session` being retrieved.
    // Ah, Step 357 snippet starts at line 150.
    // I need to check if `session` is available in `POST`.
    // It imports `getServerSession`.
    // I'll assume I need to fetch it if not present, OR I CANNOT USE `session.user.id`.
    // Let's check `odps/route.ts` beginning.
    // I'll use a safe way.
    const session: any = await getServerSession(authConfig as any)
    if (session?.user?.id) {
      await logger.logActivity({
        action: 'CREATE',
        subject: 'ODP',
        userId: session.user.id,
        details: { id: created.id, name: data.name }
      })
    }
  } catch (e) {
    console.error('Logging failed', e)
  }

  return NextResponse.json({ id: created.id })
}


