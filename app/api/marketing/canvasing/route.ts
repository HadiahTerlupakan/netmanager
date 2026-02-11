import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { isSuperAdminRole } from '@/lib/auth-helpers'
import { getCanvasingService } from '@/lib/repositories'
import { apiSuccess, ApiErrors } from '@/lib/api-response'


export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) return ApiErrors.unauthorized('Tidak terautentikasi')

    // RBAC Check & Filtering
    const isSuperAdmin = isSuperAdminRole(session.role)

    const permissions = await getUserPermissions(session.id)
    const canReadAll = isSuperAdmin || permissions.includes('canvasing:read') || permissions.includes('canvasing:verify')
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
    const canViewOthers = isSuperAdmin || canVerify || canReadAll

    console.log(`[API_CANVASING] User: ${session.email}, isSuperAdmin: ${isSuperAdmin}, canReadAll: ${canReadAll}, canVerify: ${canVerify}, canViewOthers: ${canViewOthers}`)

    if (!canViewOthers) {
        // Absolute restriction for regular Sales/Staff
        salesId = session.id
    } else {
        // Manager Logic
        if (isSiteRestricted) {
             if (session.siteId) {
                 filterSiteId = session.siteId
             } else {
                 return apiSuccess([])
             }
        }
    }

    const service = getCanvasingService()
    const filterParams: Record<string, unknown> = {}
    if (status) filterParams.status = status
    if (salesId) filterParams.salesId = salesId
    if (filterSiteId) filterParams.siteId = filterSiteId
    const requests = await service.getAllRequests(filterParams)

    // Return with data wrapper for mobile app compatibility
    return NextResponse.json({ data: requests })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal mengambil data canvasing'
    return ApiErrors.internalError(message)
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) return ApiErrors.unauthorized('Tidak terautentikasi')

    const body = await req.json()

    // Validate required fields
    if (!body.nama || !body.nama.trim()) {
      return ApiErrors.badRequest('Nama pelanggan wajib diisi')
    }
    if (!body.noTelpon || !body.noTelpon.trim()) {
      return ApiErrors.badRequest('Nomor telepon wajib diisi')
    }
    if (!body.alamat || !body.alamat.trim()) {
      return ApiErrors.badRequest('Alamat wajib diisi')
    }

    const service = getCanvasingService()

    // Explicitly map and sanitize fields
    const payload = {
      nama: body.nama.trim(),
      noKtp: body.noKtp,
      noTelpon: body.noTelpon.trim(),
      email: body.email || null,
      alamat: body.alamat.trim(),
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

    return apiSuccess(request, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal membuat data canvasing'
    return ApiErrors.internalError(message)
  }
}
