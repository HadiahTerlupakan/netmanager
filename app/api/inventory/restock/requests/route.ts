import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { PurchaseRequestStatus } from '@prisma/client'
import { createRestockRequest } from '@/app/api/inventory/_utils/restock-request-create'

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

  return createRestockRequest({
    items: items.map((item: RestockItemInput) => ({
      barangId: item.barangId,
      quantity: item.quantity || item.jumlah || 0,
    })),
    gudangId,
    keterangan,
    requesterId: session.user.id as string,
    tenantId: session.user.tenantId as string,
    apiPath: '/api/inventory/restock/requests',
  })
}
