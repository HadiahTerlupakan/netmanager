import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getCanvasingService } from '@/lib/repositories'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await verifyAuth(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // RBAC Check
    const isSuperAdmin = session.role === 'SUPER_ADMIN' || session.role === 'Super Admin'
    // const permissions = session.permissions || []
    const permissions = await getUserPermissions(session.id)
    
    // console.log(`[API_CANVASING_ID] User: ${session.email}, Role: ${session.role}, IsSuperAdmin: ${isSuperAdmin}, Permissions: ${permissions.length}`)

    if (!isSuperAdmin && !permissions.includes('canvasing:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    const service = getCanvasingService()
    const request = await service.getRequestById(id)

    if (!request) return NextResponse.json({ error: 'Request tidak ditemukan' }, { status: 404 })

    return NextResponse.json(request)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await verifyAuth(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const service = getCanvasingService()

    const request = await service.updateRequest(id, body)

    return NextResponse.json(request)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await verifyAuth(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // RBAC Check
    const isSuperAdmin = session.role === 'SUPER_ADMIN' || session.role === 'Super Admin'
    const permissions = session.permissions || []

    if (!isSuperAdmin && !permissions.includes('canvasing:delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const service = getCanvasingService()
    await service.deleteRequest(id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
