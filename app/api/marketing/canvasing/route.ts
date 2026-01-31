import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { isSuperAdminRole } from '@/lib/auth-helpers'
import { getCanvasingService } from '@/lib/repositories'


export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // RBAC Check & Filtering
    const isSuperAdmin = isSuperAdminRole(session.role)

    const permissions = await getUserPermissions(session.id)
    const _canReadAll = isSuperAdmin || permissions.includes('canvasing:verify')
    const isSiteRestricted = permissions.includes('canvasing:site_only') && !isSuperAdmin

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    let salesId = searchParams.get('salesId') || undefined
    let filterSiteId: string | undefined = searchParams.get('siteId') || undefined

    // Logic:
    // 1. If Super Admin -> Can see all (no default filters)
    // 2. If Site Restricted (e.g. Site Manager) -> Filter by Site
    // 3. If Sales (no read all, no site restricted) -> Filter by Own ID

    // Logic Reform:
    // 1. Strict Ownership: If you don't have 'verify' permission (Manager), you ONLY see your own data.
    // 2. Site Restriction: If you are a Manager but restricted to 'site_only', you see all data in your site.
    // 3. Super Admin: Sees everything.

    const canVerify = permissions.includes('canvasing:verify')
    const canViewOthers = isSuperAdmin || canVerify

    if (!canViewOthers) {
        // Absolute restriction for regular Sales/Staff
        salesId = session.id
    } else {
        // Manager Logic
        if (isSiteRestricted) {
             if (session.siteId) {
                 filterSiteId = session.siteId
             } else {
                 return NextResponse.json([])
             }
        }
    }

    const service = getCanvasingService()
    // NOTE: Service needs update to support `siteId` filtering or we rely on Prisma relation filter in service
    // Checking CanvasingService...
    // If service doesn't support siteId, we might need to modify it or the Repo.
    const filterParams: Record<string, unknown> = {}
    if (status) filterParams.status = status
    if (salesId) filterParams.salesId = salesId
    if (filterSiteId) filterParams.siteId = filterSiteId
    const requests = await service.getAllRequests(filterParams)

    return NextResponse.json(requests)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
