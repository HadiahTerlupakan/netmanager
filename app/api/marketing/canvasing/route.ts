import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getCanvasingService } from '@/lib/repositories'

export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // RBAC Check
    const isSuperAdmin = session.role === 'SUPER_ADMIN' || session.role === 'Super Admin'
    const permissions = session.permissions || []
    
    console.log(`[API_CANVASING] User: ${session.email}, Role: ${session.role}, IsSuperAdmin: ${isSuperAdmin}, Permissions: ${permissions.length}`)

    if (!isSuperAdmin && !permissions.includes('canvasing:read')) {
      console.warn(`[API_CANVASING] Forbidden for user ${session.email}`)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') as any
    const salesId = searchParams.get('salesId') || undefined

    const service = getCanvasingService()
    const requests = await service.getAllRequests({ status, salesId })

    return NextResponse.json(requests)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const service = getCanvasingService()

    const request = await service.createRequest({
      ...body,
      salesId: session.id,
      kabel: Number(body.kabel) || 0
    })

    return NextResponse.json(request, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
