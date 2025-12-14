import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getJoinboxRepository } from '@/lib/repositories'
import { joinboxCreateSchema } from '@/lib/validations/joinbox'

/**
 * @swagger
 * /api/joinboxes:
 *   get:
 *     summary: Get all Joinbox records
 *     description: Retrieve a list of all joinbox records for FTTH network infrastructure
 *     tags: [FTTH Infrastructure]
 *     responses:
 *       200:
 *         description: Successfully retrieved joinbox records
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Joinbox'
 *       500:
 *         $ref: '#/components/responses/Error'
 *
 *   post:
 *     summary: Create a new Joinbox
 *     description: Create a new joinbox record for FTTH network infrastructure
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
 *               - location
 *             properties:
 *               name:
 *                 type: string
 *                 description: Joinbox name/identifier
 *                 example: "JB-001"
 *               location:
 *                 type: string
 *                 description: Physical location of joinbox
 *                 example: "Jl. Sudirman No. 200"
 *               type:
 *                 type: string
 *                 enum: [straight, through, terminal]
 *                 description: Type of joinbox
 *                 example: "straight"
 *               capacity:
 *                 type: integer
 *                 description: Number of ports/capacity
 *                 example: 12
 *               status:
 *                 type: string
 *                 enum: [active, inactive, maintenance]
 *                 description: Current status of joinbox
 *                 example: "active"
 *               notes:
 *                 type: string
 *                 description: Additional notes about joinbox
 *                 example: "Weatherproof enclosure"
 *     responses:
 *       200:
 *         description: Successfully created joinbox
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: Created joinbox ID
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
  const repo = getJoinboxRepository()
  const items = await repo.findAll()
  return NextResponse.json({ items })
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const json = await req.json()
  const parsed = joinboxCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const repo = getJoinboxRepository()
  const created = await repo.create(parsed.data as any)
  return NextResponse.json({ id: created.id })
}


