import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { randomUUID } from 'crypto'
import { getRestockRequestDetail, patchRestockRequestLifecycle } from '@/app/api/inventory/_utils/restock-request-lifecycle'
import { hasPermission } from '@/lib/rbac'

interface RestockItemInput {
  barangId: string
  quantity?: number
  jumlah?: number
}

// GET: Single request detail
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  }

  if (!(await hasPermission('restock:read'))) {
    return NextResponse.json({ error: 'Akses ditolak. Butuh izin restock:read' }, { status: 403 })
  }

  const { id } = await params
  return getRestockRequestDetail(id)
}

// PATCH: Update request status/lifecycle
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json()

  return patchRestockRequestLifecycle({
    id,
    action: body.action,
    catatan: body.catatan,
    actorId: session.user.id as string
  })
}

// PUT: Update request
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  }

  if (!(await hasPermission('restock:update'))) {
    return NextResponse.json({ error: 'Akses ditolak. Butuh izin restock:update' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { items, gudangId, keterangan } = body
  const tenantId = session.user.tenantId as string

  const existing = await prisma.purchaseRequest.findUnique({
    where: { id, tenantId }
  })

  if (!existing) {
    return NextResponse.json({ error: 'Pengajuan tidak ditemukan' }, { status: 404 })
  }

  if (existing.status !== 'DRAFT' && existing.status !== 'SUBMITTED') {
    return NextResponse.json({ error: 'Hanya pengajuan Draft/Submitted yang bisa diubah' }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Delete old items
      await tx.purchaseRequestItem.deleteMany({ where: { purchaseRequestId: id } })

      // Update PR and Create new items
      return await tx.purchaseRequest.update({
        where: { id },
        data: {
          gudangId,
          keterangan,
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
    })

    return NextResponse.json({ data: result, message: 'Pengajuan berhasil diperbarui' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Terjadi kesalahan'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE: Delete request
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  }

  if (!(await hasPermission('restock:delete'))) {
    return NextResponse.json({ error: 'Akses ditolak. Butuh izin restock:delete' }, { status: 403 })
  }

  const { id } = await params
  const tenantId = session.user.tenantId as string

  const existing = await prisma.purchaseRequest.findUnique({
    where: { id, tenantId }
  })

  if (!existing) {
    return NextResponse.json({ error: 'Pengajuan tidak ditemukan' }, { status: 404 })
  }



  await prisma.purchaseRequest.delete({ where: { id } })

  return NextResponse.json({ message: 'Pengajuan berhasil dihapus' })
}
