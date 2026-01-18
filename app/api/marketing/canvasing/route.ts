import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { isSuperAdminRole } from '@/lib/auth-helpers'
import { hasPermission } from '@/lib/rbac'
import { getCanvasingService } from '@/lib/repositories'


export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // RBAC Check & Filtering
    const isSuperAdmin = isSuperAdminRole(session.role)

    const permissions = await getUserPermissions(session.id)
    const canReadAll = isSuperAdmin || permissions.includes('canvasing:read')
    const isSiteRestricted = permissions.includes('canvasing:site_only') && !isSuperAdmin

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') as any
    let salesId = searchParams.get('salesId') || undefined
    let filterSiteId: string | undefined = searchParams.get('siteId') || undefined

    // Logic:
    // 1. If Super Admin -> Can see all (no default filters)
    // 2. If Site Restricted (e.g. Site Manager) -> Filter by Site
    // 3. If Sales (no read all, no site restricted) -> Filter by Own ID

    if (!isSuperAdmin) {
        if (isSiteRestricted) {
             // Site Manager Logic
             if (session.siteId) {
                 filterSiteId = session.siteId
             } else {
                 // Restricted but no site? Return empty
                 return NextResponse.json([])
             }
        } else if (!canReadAll) {
             // Sales / Regular User Logic
             salesId = session.id
        }
    }

    const service = getCanvasingService()
    // NOTE: Service needs update to support `siteId` filtering or we rely on Prisma relation filter in service
    // Checking CanvasingService...
    // If service doesn't support siteId, we might need to modify it or the Repo.
    const requests = await service.getAllRequests({ status, salesId, siteId: filterSiteId })

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
