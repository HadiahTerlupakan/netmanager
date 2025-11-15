/**
 * API endpoint untuk mendapatkan semua Card (Frame) dari OLT via SNMP
 * GET /api/olts/[id]/cards - Get all cards from OLT
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOLTRepository } from '@/lib/repositories'
import { getAllCardsViaSNMP } from '@/app/api/olts/onus/route'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || session?.user?.role !== 'ADMIN') {
    return null
  }
  return session
}

/**
 * @swagger
 * /api/olts/{id}/cards:
 *   get:
 *     summary: Get all cards from OLT via SNMP
 *     description: Mengambil daftar semua Card (Frame) dari OLT menggunakan SNMP. Card = Frame dalam format Frame/Slot/Port.
 *     tags: [OLTs]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: OLT ID
 *     responses:
 *       200:
 *         description: Daftar cards berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 cards:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       frame:
 *                         type: number
 *                       card:
 *                         type: number
 *                       slots:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             slot:
 *                               type: number
 *                             ports:
 *                               type: array
 *                               items:
 *                                 type: number
 *                       totalSlots:
 *                         type: number
 *                       totalPorts:
 *                         type: number
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: OLT not found
 *       500:
 *         description: Server error
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const oltRepository = getOLTRepository()
    const olt = await oltRepository.findById(id)

    if (!olt) {
      return NextResponse.json({ error: 'OLT not found' }, { status: 404 })
    }

    // Check if SNMP is connected
    if (!olt.snmpConnected || !olt.snmpCommunityWrite) {
      return NextResponse.json(
        {
          error: 'SNMP not connected for this OLT',
          message: 'OLT harus terhubung via SNMP untuk mendapatkan data cards',
        },
        { status: 400 }
      )
    }

    console.log(`[Card-API] Getting cards from OLT ${olt.name} (${olt.ipAddress})...`)

    // Get cards via SNMP
    const cards = await getAllCardsViaSNMP(
      olt.ipAddress,
      olt.snmpPort,
      olt.snmpCommunityWrite,
      olt.snmpVersion
    )

    return NextResponse.json({
      success: true,
      cards,
      oltId: olt.id,
      oltName: olt.name,
      totalCards: cards.length,
      totalPorts: cards.reduce((sum, card) => sum + card.totalPorts, 0),
    })
  } catch (error: any) {
    console.error('[Card-API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get cards from OLT',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

