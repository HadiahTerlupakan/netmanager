import { NextRequest, NextResponse } from 'next/server'

import { verifyAuth, hasPermission } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { patchRestockRequestStatus } from '@/app/api/inventory/_utils/restock-request-status'
import { ProcurementService } from '@/modules/procurement'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAuth(req)
  if (!session) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  }

  const hasAccess = await hasPermission(session.id, 'restock', 'verify')
  if (!hasAccess) {
    return NextResponse.json({ error: 'Akses ditolak. Butuh izin restock:verify' }, { status: 403 })
  }

  const { id } = await params
  const requestRecord = await prisma.purchaseRequest.findUnique({
    where: { id },
    select: { purchaseOrderId: true, status: true },
  })

  if (!requestRecord) {
    return NextResponse.json({ error: 'Purchase Request not found' }, { status: 404 })
  }

  let purchaseOrderId = requestRecord.purchaseOrderId

  // Auto-generate PO jika belum ada (flow: Approve → langsung Verifikasi)
  if (!purchaseOrderId) {
    try {
      const procurementService = new ProcurementService()
      const pos = await procurementService.generatePOFromPRs([id], session.id)
      if (pos && pos.length > 0) {
        purchaseOrderId = pos[0].id
      }
    } catch (error) {
      console.error('Auto-generate PO on receive error:', error)
    }

    if (!purchaseOrderId) {
      return NextResponse.json(
        { error: 'Gagal membuat Purchase Order. Coba lagi atau hubungi admin.' },
        { status: 500 }
      )
    }
  }

  const body = await req.json()

  return patchRestockRequestStatus({
    purchaseOrderId,
    action: 'RECEIVE',
    items: body.items,
    closePO: body.closePO,
    actorId: session.id,
    fotoBukti: body.fotoBukti,
  })
}
