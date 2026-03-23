import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { randomUUID } from 'crypto'
import { PurchaseRequestStatus } from '@prisma/client'

interface RestockItemInput {
  barangId: string
  quantity?: number
  jumlah?: number
}

// GET: List all requests
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  }

  const tenantId = session.user.tenantId as string
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const requests = await prisma.purchaseRequest.findMany({
    where: {
      tenantId,
      ...(status && { status: status as PurchaseRequestStatus })
    },
    include: {
      items: {
        include: { barang: true }
      },
      requester: { select: { name: true } },
      approver: { select: { name: true } },
      gudang: { select: { nama: true, id: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  return NextResponse.json({ data: requests })
}

// POST: Create new request
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  }

  const body = await req.json()
  const { items, gudangId, keterangan } = body
  const tenantId = session.user.tenantId as string

  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'Item pengajuan tidak boleh kosong' }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Generate request number (PR-YYYYMMDD-XXXX)
      const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const count = await tx.purchaseRequest.count({
        where: { tenantId, createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) } }
      })
      const nomorRequest = `PR-${date}-${(count + 1).toString().padStart(4, '0')}`

      const request = await tx.purchaseRequest.create({
        data: {
          id: randomUUID(),
          nomorRequest,
          requesterId: session.user.id as string,
          gudangId,
          keterangan,
          status: 'DRAFT',
          tenantId,
          items: {
            create: items.map((item: RestockItemInput) => ({
              id: randomUUID(),
              barangId: item.barangId,
              jumlah: item.quantity || item.jumlah || 0,
              hargaPerUnit: 0,
              totalHarga: 0,
              tenantId
            }))
          }
        },
        include: { items: true }
      })

      return request
    })

    return NextResponse.json({ data: result, message: 'Pengajuan restock berhasil dibuat' })
  } catch (error: unknown) {
    console.error('Create PR error:', error)
    const message = error instanceof Error ? error.message : 'Gagal membuat pengajuan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
