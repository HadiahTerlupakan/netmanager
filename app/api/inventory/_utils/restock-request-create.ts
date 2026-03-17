import { NextResponse } from 'next/server'

import { logger } from '@/lib/logger'
import { prisma } from '@/lib/prisma'

interface RestockRequestItemInput {
  barangId: string
  quantity: number
}

interface CreateRestockRequestInput {
  items: RestockRequestItemInput[]
  gudangId: string
  keterangan?: string
  requesterId: string
  tenantId?: string | null
  apiPath: string
}

export async function createRestockRequest({
  items,
  gudangId,
  keterangan,
  requesterId,
  tenantId,
  apiPath,
}: CreateRestockRequestInput) {
  const startTime = Date.now()

  try {
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Daftar item wajib diisi (minimal 1 item)' }, { status: 400 })
    }

    if (!gudangId) {
      return NextResponse.json({ error: 'Gudang tujuan wajib dipilih' }, { status: 400 })
    }

    const date = new Date()
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '')
    const prefix = `PR-${dateStr}-`

    const lastPR = await prisma.purchaseRequest.findFirst({
      where: { 
        tenantId: tenantId,
        nomorRequest: { startsWith: prefix } 
      },
      orderBy: { nomorRequest: 'desc' },
    })

    let sequence = 1
    if (lastPR) {
      const lastSeq = parseInt(lastPR.nomorRequest.split('-')[2] || '0')
      if (!Number.isNaN(lastSeq)) {
        sequence = lastSeq + 1
      }
    }

    const nomorRequest = `${prefix}${sequence.toString().padStart(4, '0')}`
    const dbStart = Date.now()

    const pr = await prisma.$transaction(async (tx) => {
      return tx.purchaseRequest.create({
        data: {
          id: crypto.randomUUID(),
          nomorRequest,
          tenantId,
          requesterId,
          gudangId,
          keterangan,
          status: 'DRAFT',
          items: {
            create: items.map((item) => ({
              id: crypto.randomUUID(),
              barangId: item.barangId,
              jumlah: item.quantity,
              hargaPerUnit: 0,
              totalHarga: 0,
            })),
          },
        },
        include: {
          items: {
            include: {
              barang: true,
            },
          },
        },
      })
    })

    logger.dbOperation('transaction', 'CreatePurchaseRequest', Date.now() - dbStart)
    logger.apiRequest('POST', apiPath, 201, Date.now() - startTime, {
      userId: requesterId,
      prId: pr.id,
    })

    return NextResponse.json(pr, { status: 201 })
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error('Terjadi kesalahan')
    logger.error('Error creating purchase request', err, {
      path: apiPath,
      method: 'POST',
    })
    return NextResponse.json({ error: 'Gagal membuat Purchase Request' }, { status: 500 })
  }
}
