import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getRestockRequestDetail, patchRestockRequestLifecycle } from '@/app/api/inventory/_utils/restock-request-lifecycle'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  }

  if (!(await hasPermission('purchase_orders:read'))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }

  const { id } = await params
  return getRestockRequestDetail(id)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  }

  if (!(await hasPermission('purchase_orders:update'))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()

  return patchRestockRequestLifecycle({
    id,
    action: body.action,
    catatan: body.catatan,
    actorId: session.user.id as string,
  })
}
