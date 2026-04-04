import { NextRequest, NextResponse } from 'next/server'

import { patchRestockRequestStatus } from '@/app/api/inventory/_utils/restock-request-status'
import { verifyAuth, hasPermission } from '@/lib/auth'
import { prisma } from '@/modules/database'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAuth(req)
  if (!session) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  }

  const hasAccess = await hasPermission(session.id, 'restock', 'update')
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
      { error: 'Purchase Request belum memiliki Purchase Order untuk diproses' },
      { status: 400 }
    )
  }

  return patchRestockRequestStatus({
    purchaseOrderId: requestRecord.purchaseOrderId,
    action: 'START_SHOPPING',
    actorId: session.id,
  })
}
