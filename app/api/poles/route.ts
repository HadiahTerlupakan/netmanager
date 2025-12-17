import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getPoleRepository } from '@/lib/repositories'
import { poleCreateSchema } from '@/lib/validations/pole'

/**
 * @swagger
 * /api/poles:
 *   get:
 *     summary: Get all Pole records
 *     description: Retrieve a list of all pole records for FTTH network infrastructure
 *     tags: [FTTH Infrastructure]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved pole records
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 poles:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Pole'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/Error'
 *
 *   post:
 *     summary: Create a new Pole
 *     description: Create a new pole record for FTTH network infrastructure
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
 *             properties:
 *               name:
 *                 type: string
 *                 description: Pole name/identifier
 *                 example: "Pole-001"
 *               location:
 *                 type: string
 *                 description: Physical location of pole
 *                 example: "Jl. Sudirman No. 100"
 *               notes:
 *                 type: string
 *                 description: Additional notes about pole
 *                 example: "Concrete pole, 9m height"
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
 *               cableSlack:
 *                 type: boolean
 *                 description: Whether pole has cable slack storage
 *                 example: false
 *     responses:
 *       200:
 *         description: Successfully created pole
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: Created pole ID
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
  const repo = getPoleRepository()
  const poles = await repo.findAll()
  return NextResponse.json({ poles })
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const json = await req.json()
  const parsed = poleCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data
  const repo = getPoleRepository()
  const created = await repo.create(parsed.data as any)

  // System Log
  try {
    const { logger } = await import('@/lib/logger')
    await logger.logActivity({
      action: 'CREATE',
      subject: 'Pole',
      userId: session.user.id,
      details: { id: created.id, name: parsed.data.name }
    })
  } catch (e) {
    console.error('Logging failed', e)
  }

  return NextResponse.json({ id: created.id })
}
