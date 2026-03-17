import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { createRestockRequest } from '@/app/api/inventory/_utils/restock-request-create'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 })
  }

  if (!(await hasPermission('restock:update'))) {
    return NextResponse.json({ error: 'Akses ditolak' }, { status: 403 })
  }

  const body = await req.json()

  return createRestockRequest({
    items: body.items,
    gudangId: body.gudangId,
    keterangan: body.keterangan,
    requesterId: session.user.id as string,
    tenantId: session.user.tenantId,
    apiPath: '/api/inventory/restock/requests',
  })
}
