import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

/**
 * POST /api/inventory/procurement/purchase-request
 * Create a new Purchase Request from Restock Alerts
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission (assuming restock:update or new PR permission)
    // For now reusing restock:update as it's part of restock management
    if (!(await hasPermission("restock:update"))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { items, gudangId, keterangan } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: 'Items are required' }, { status: 400 })
    }

    if (!gudangId) {
        return NextResponse.json({ error: 'Gudang ID is required' }, { status: 400 })
    }

    // Generate PR Number (PR-YYYYMMDD-XXXX)
    const date = new Date()
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
    const prefix = `PR-${dateStr}-`
    
    // Find last PR number today
    const lastPR = await prisma.purchaseRequest.findFirst({
        where: {
            nomorRequest: {
                startsWith: prefix
            }
        },
        orderBy: {
            nomorRequest: 'desc'
        }
    })

    let sequence = 1
    if (lastPR) {
        const lastSeq = parseInt(lastPR.nomorRequest.split('-')[2] || '0')
        if (!isNaN(lastSeq)) {
            sequence = lastSeq + 1
        }
    }

    const nomorRequest = `${prefix}${sequence.toString().padStart(4, '0')}`

    const dbStart = Date.now()

    // Create Purchase Request Transaction
    const pr = await prisma.$transaction(async (tx) => {
        // Create Header
        const newPR = await tx.purchaseRequest.create({
            data: {
                id: crypto.randomUUID(),
                nomorRequest,
                requesterId: session.user.id as string,
                gudangId,
                keterangan,
                status: 'DRAFT',
                items: {
                    create: items.map((item: { barangId: string; quantity: number }) => ({
                        id: crypto.randomUUID(),
                        barangId: item.barangId,
                        jumlah: item.quantity,
                        hargaPerUnit: 0, // Estimasi or fetched from master
                        totalHarga: 0
                    }))
                }
            },
            include: {
                items: {
                    include: {
                        barang: true
                    }
                }
            }
        })
        
        // Ensure alerts are marked as processed? 
        // Not strictly necessary as PR is separate, but good for UX.
        // For now we keep alerts active until stock physically increases.

        return newPR
    })

    logger.dbOperation('transaction', 'CreatePurchaseRequest', Date.now() - dbStart)
    logger.apiRequest('POST', '/api/inventory/procurement/purchase-request', 201, Date.now() - startTime, {
        userId: session.user.id,
        prId: pr.id
    })

    return NextResponse.json(pr, { status: 201 })

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Unknown error')
    logger.error('Error creating purchase request', err, {
      path: '/api/inventory/procurement/purchase-request',
      method: 'POST',
    })
    return NextResponse.json(
      { error: 'Gagal membuat Purchase Request' },
      { status: 500 }
    )
  }
}
