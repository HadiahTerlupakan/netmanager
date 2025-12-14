import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOdcRepository } from '@/lib/repositories'
import { odcCreateSchema } from '@/lib/validations/odc'

/**
 * @swagger
 * /api/odcs:
 *   get:
 *     summary: Get all ODC (Optical Distribution Cabinet) records
 *     description: Retrieve a list of all ODC records with their outputs and configurations
 *     tags: [FTTH Infrastructure]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved ODC records
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 odcs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Odc'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/Error'
 *
 *   post:
 *     summary: Create a new ODC (Optical Distribution Cabinet)
 *     description: Create a new ODC record with outputs configuration for FTTH network infrastructure
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
 *               - otbCoreId
 *             properties:
 *               name:
 *                 type: string
 *                 description: ODC name/identifier
 *                 example: "ODC-001"
 *               location:
 *                 type: string
 *                 description: Physical location of ODC
 *                 example: "Jl. Sudirman No. 456"
 *               notes:
 *                 type: string
 *                 description: Additional notes about ODC
 *                 example: "Secondary distribution point"
 *               keteranganJumlahKabelFeeder:
 *                 type: string
 *                 description: Description of feeder cables
 *                 example: "2 x 12 core distribution cables"
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
 *               otbCoreId:
 *                 type: integer
 *                 description: Reference to OTB core ID
 *                 example: 1
 *               outputs:
 *                 type: array
 *                 description: Output configurations
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
 *                       example: "Slot-A1"
 *                     redaman:
 *                       type: number
 *                       format: float
 *                       description: Attenuation/loss value in dB
 *                       example: 0.3
 *                     tubeColor:
 *                       type: string
 *                       description: Tube color identifier
 *                       example: "Blue"
 *                     coreColor:
 *                       type: string
 *                       description: Core color identifier
 *                       example: "Orange"
 *     responses:
 *       200:
 *         description: Successfully created ODC
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: Created ODC ID
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
  const repo = getOdcRepository()
  const odcs = await repo.findAll()
  return NextResponse.json({ odcs })
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const json = await req.json()
  const parsed = odcCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data
  const repo = getOdcRepository()
  const created = await repo.create({
    name: data.name,
    location: data.location ?? null,
    notes: data.notes ?? null,
    keteranganJumlahKabelFeeder: data.keteranganJumlahKabelFeeder ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    otbCoreId: data.otbCoreId,
    outputs: data.outputs?.map((o, idx) => ({
      idx: o.idx ?? idx,
      slotName: o.slotName,
      redaman: o.redaman ?? null,
      tubeColor: o.tubeColor,
      coreColor: o.coreColor,
    })),
  })
  return NextResponse.json({ id: created.id })
}


