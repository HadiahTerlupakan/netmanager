import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { isSuperAdminRole } from '@/lib/auth-helpers'
import { hasPermission } from '@/lib/rbac'
import { getCanvasingService } from '@/lib/repositories'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await verifyAuth(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = getCanvasingService()
    const request = await service.getRequestById(id)

    if (!request) return NextResponse.json({ error: 'Request tidak ditemukan' }, { status: 404 })

    // RBAC Check - Allow owner to view their own request
    const isSuperAdmin = isSuperAdminRole(session.role)
    const permissions = await getUserPermissions(session.id)
    const isOwner = request.salesId === session.id
    
    console.log(`[API_CANVASING_ID] User: ${session.email}, SessionId: ${session.id}, SalesId: ${request.salesId}, IsOwner: ${isOwner}`)

    if (!isSuperAdmin && !isOwner && !permissions.includes('canvasing:read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await verifyAuth(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    const body = await req.json()
    
    // RBAC Check
    const isSuperAdmin = isSuperAdminRole(session.role)
    const permissions = await getUserPermissions(session.id)
    
    if (!isSuperAdmin && !permissions.includes('canvasing:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const service = getCanvasingService()

    // Handle cancel_approval action
    if (body.action === 'cancel_approval') {
      const request = await service.getRequestById(id)
      if (!request) return NextResponse.json({ error: 'Request tidak ditemukan' }, { status: 404 })
      
      if (request.status !== 'APPROVED') {
        return NextResponse.json({ error: 'Hanya canvasing APPROVED yang bisa dibatalkan' }, { status: 400 })
      }

      // Cancel approval - reset to PENDING
      const updated = await service.cancelApproval(id)
      return NextResponse.json(updated)
    }

    // Regular update
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
    const isSuperAdmin = isSuperAdminRole(session.role)
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
