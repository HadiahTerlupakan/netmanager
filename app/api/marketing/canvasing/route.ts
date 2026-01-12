import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getCanvasingService } from '@/lib/repositories'

export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // RBAC Check & Filtering
    const isSuperAdmin = session.role === 'SUPER_ADMIN' || session.role === 'Super Admin'
    // const permissions = session.permissions || []
    const permissions = await getUserPermissions(session.id)
    const canReadAll = isSuperAdmin || permissions.includes('canvasing:read')

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') as any
    let salesId = searchParams.get('salesId') || undefined

    // If user cannot read all, force filter to their own ID
    if (!canReadAll) {
      salesId = session.id
    }

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

    // Explicitly map and sanitize fields
    const payload = {
      nama: body.nama,
      noKtp: body.noKtp,
      noTelpon: body.noTelpon,
      email: body.email || null,
      alamat: body.alamat,
      kabel: body.kabel ? Number(body.kabel) : 0,
      odp: body.odp || null,
      paket: body.paket || null,
      sn: body.sn || null,
      latitude: body.latitude ? Number(body.latitude) : null,
      longitude: body.longitude ? Number(body.longitude) : null,
      foto: body.foto || null,
      fotoKtp: body.fotoKtp || null,
      salesId: session.id,
    }

    const request = await service.createRequest(payload)

    return NextResponse.json(request, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
