import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, getUserPermissions } from '@/lib/auth'
import { isSuperAdminRole } from '@/lib/auth-helpers'
import { getCanvasingService } from '@/lib/repositories'
import { apiSuccess, ApiErrors } from '@/lib/api-response'
import { z } from 'zod'

// Zod Schema for validation
const canvasingSchema = z.object({
  nama: z.string().min(1, 'Nama pelanggan wajib diisi').trim(),
  noKtp: z.string().min(1, 'No KTP wajib diisi').trim(),
  noTelpon: z.string().min(1, 'Nomor telepon wajib diisi').trim(),
  email: z.string().email('Format email tidak valid').optional().or(z.literal('')),
  alamat: z.string().min(1, 'Alamat wajib diisi').trim(),
  kabel: z.coerce.number().min(0, 'Kabel tidak boleh negatif').default(0),
  odp: z.string().optional(),
  paket: z.string().min(1, 'Paket wajib diisi').trim(),
  sn: z.string().optional(),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
  foto: z.string().optional(),
  fotoKtp: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await verifyAuth(req)
    if (!session) return ApiErrors.unauthorized('Tidak terautentikasi')

    const isSuperAdmin = isSuperAdminRole(session.role)
    const permissions = await getUserPermissions(session.id)
    
    // RBAC:
    // canvasing:read_all -> Can see all data (Admin)
    // canvasing:verify -> Can verify data (Manager)
    // None of the above -> Can only see own data (Sales)
    const canReadAll = isSuperAdmin || permissions.includes('canvasing:read_all')
    const canVerify = permissions.includes('canvasing:verify')
    const isSiteRestricted = permissions.includes('canvasing:site_only') && !isSuperAdmin

    const canViewOthers = canReadAll || canVerify

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    let salesId = searchParams.get('salesId') || undefined
    let filterSiteId: string | undefined = searchParams.get('siteId') || undefined

    if (!canViewOthers) {
        // Sales can ONLY see their own data
        salesId = session.id
    } else {
        // Manager/Admin Logic
        if (isSiteRestricted) {
             if (session.siteId) {
                 filterSiteId = session.siteId
             } else {
                 return apiSuccess([]) // No site assigned, return empty
             }
        }
    }

    const service = getCanvasingService()
    const filterParams: Record<string, unknown> = {}
    if (status) filterParams.status = status
    if (salesId) filterParams.salesId = salesId
    if (filterSiteId) filterParams.siteId = filterSiteId
    const requests = await service.getAllRequests(filterParams)

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

    // Validate using Zod
    const validationResult = canvasingSchema.safeParse(body)
    if (!validationResult.success) {
      const errorMessage = validationResult.error.issues.map(e => e.message).join(', ')
      return ApiErrors.badRequest(`Validasi gagal: ${errorMessage}`)
    }

    const validatedData = validationResult.data
    const service = getCanvasingService()

    const payload = {
      ...validatedData,
      salesId: session.id,
      siteId: session.siteId || null, // Propagate siteId from sales's session
    }

    const request = await service.createRequest(payload)

    return apiSuccess(request, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal membuat data canvasing'
    return ApiErrors.internalError(message)
  }
}
