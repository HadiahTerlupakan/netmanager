import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/modules/database'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  }

  // Business Rule: Need specific permission for approval
  if (!(await hasPermission('restock:approve'))) {
    return NextResponse.json({ error: 'Akses ditolak. Butuh izin restock:approve' }, { status: 403 })
  }

  const { id } = await params
  const tenantId = session.user.tenantId as string

  const request = await prisma.purchaseRequest.findUnique({
    where: { id, tenantId }
  })

  if (!request) {
    return NextResponse.json({ error: 'Pengajuan tidak ditemukan' }, { status: 404 })
  }

  if (request.status !== 'DRAFT' && request.status !== 'SUBMITTED') {
    return NextResponse.json({ error: 'Pengajuan sudah diproses' }, { status: 400 })
  }

  const updated = await prisma.purchaseRequest.update({
    where: { id },
    data: {
      status: 'APPROVED',
      approvedBy: session.user.id as string,
      approvedAt: new Date(),
      updatedAt: new Date()
    }
  })

  return NextResponse.json({ data: updated, message: 'Pengajuan berhasil disetujui' })
}
