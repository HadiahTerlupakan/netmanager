/**
 * API endpoint untuk mendapatkan semua Card (Frame) dari OLT via SNMP
 * GET /api/olts/[id]/cards - Get all cards from OLT
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOLTRepository } from '@/lib/repositories'
import { getC300GponOnuDataViaSNMP } from '@/app/api/onus/sync/route'
import snmp from 'net-snmp'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

/**
 * Helper function untuk SNMP walk
 */
function snmpWalkHelper(
  session: any,
  oid: string
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const callback = (error: any, varbinds: any[]) => {
      if (error) {
        reject(error)
      } else {
        resolve(varbinds)
      }
    }
    // @ts-ignore - net-snmp types mungkin tidak akurat
    session.subtree(oid, callback)
  })
}

/**
 * Extract cards from ONU data
 * Format gponOnu: "Frame/Slot/Port:ONU_ID" (contoh: "1/3/1:3")
 */
function extractCardsFromOnuData(onus: Array<{ gponOnu: string }>): Array<{
  frame: number
  card: number
  slots: Array<{ slot: number; ports: number[] }>
  totalSlots: number
  totalPorts: number
}> {
  const cards: Map<number, { frame: number; card: number; slots: Map<number, Set<number>> }> = new Map()

  for (const onu of onus) {
    // Parse format: "Frame/Slot/Port:ONU_ID" atau "Frame/Slot/Port"
    const match = onu.gponOnu.match(/^(\d+)\/(\d+)\/(\d+)(?::\d+)?$/)
    if (match) {
      const frame = parseInt(match[1], 10)
      const slot = parseInt(match[2], 10)
      const port = parseInt(match[3], 10)

      if (!cards.has(frame)) {
        cards.set(frame, {
          frame,
          card: frame,
          slots: new Map(),
        })
      }

      const card = cards.get(frame)!
      if (!card.slots.has(slot)) {
        card.slots.set(slot, new Set())
      }
      card.slots.get(slot)!.add(port)
    }
  }

  // Convert to array format
  const result = Array.from(cards.values()).map((card) => {
    const slots = Array.from(card.slots.entries()).map(([slot, ports]) => ({
      slot,
      ports: Array.from(ports).sort((a, b) => a - b),
    }))

    return {
      frame: card.frame,
      card: card.card,
      slots,
      totalSlots: slots.length,
      totalPorts: slots.reduce((sum, s) => sum + s.ports.length, 0),
    }
  })

  return result.sort((a, b) => a.frame - b.frame)
}

/**
 * Get all cards (frames) from OLT via SNMP
 * Menggunakan data ONU yang sudah di-fetch untuk extract cards
 * Format gponOnu: "Frame/Slot/Port:ONU_ID" (contoh: "1/3/1:3")
 */
async function getAllCardsViaSNMP(
  ipAddress: string,
  port: number,
  community: string,
  version: string,
  oltId: string
): Promise<Array<{
  frame: number
  card: number
  slots: Array<{ slot: number; ports: number[] }>
  totalSlots: number
  totalPorts: number
}>> {
  try {
    console.log(`[Card-SNMP] Fetching ONU data to extract cards from OLT ${oltId}...`)
    
    // Fetch ONU data yang sudah memiliki format gponOnu
    const onuData = await getC300GponOnuDataViaSNMP(
      ipAddress,
      port,
      community,
      version,
      oltId
    )

    console.log(`[Card-SNMP] Found ${onuData.length} ONUs, extracting cards...`)

    // Extract cards from ONU data
    const cards = extractCardsFromOnuData(onuData)

    console.log(`[Card-SNMP] Extracted ${cards.length} frames with slots and ports from ONU data`)

    return cards
  } catch (error: any) {
    console.error('[Card-SNMP] Error:', error)
    throw error
  }
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
    const { provider } = await params
const { id } = await params
    const { provider } = await params
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

    // Get cards via SNMP (extract from ONU data)
    const cards = await getAllCardsViaSNMP(
      olt.ipAddress,
      olt.snmpPort,
      olt.snmpCommunityWrite,
      olt.snmpVersion,
      olt.id
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

