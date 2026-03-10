import { NextRequest, NextResponse } from 'next/server'

import { verifyAuth, hasPermission } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { patchRestockRequestStatus } from '@/app/api/inventory/_utils/restock-request-status'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAuth(req)
  if (!session) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  }

  let hasAccess = await hasPermission(session.id, 'purchase_orders', 'receive')
  if (!hasAccess) {
    hasAccess = await hasPermission(session.id, 'purchase_orders', 'update')
  }

  if (!hasAccess) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }

  const { id } = await params
  const requestRecord = await prisma.purchaseRequest.findUnique({
    where: { id },
    select: { purchaseOrderId: true },
  })

  if (!requestRecord) {
    return NextResponse.json({ error: 'Purchase Request not found' }, { status: 404 })
  }

  if (!requestRecord.purchaseOrderId) {
    return NextResponse.json(
      { error: 'Purchase Request belum memiliki Purchase Order untuk diterima' },
      { status: 400 }
    )
  }

  const body = await req.json()

  return patchRestockRequestStatus({
    purchaseOrderId: requestRecord.purchaseOrderId,
    action: 'RECEIVE',
    items: body.items,
    closePO: body.closePO,
    actorId: session.id,
  })
}
