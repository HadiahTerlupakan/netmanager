import { getHybridUser } from '@/lib/hybrid-auth'
import { hasPermission } from '@/lib/rbac'
import { getOdcRepository } from '@/lib/repositories'
import { odcCreateSchema } from '@/lib/validations/odc'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

export async function GET(req: Request) {
  const user = await getHybridUser(req)
  if (!user) return ApiErrors.unauthorized('Session tidak valid')

  if (!(await hasPermission("odc:read", user))) {
    return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat ODC')
  }

  const isSiteRestricted = (await hasPermission("odc:site_only", user)) && (user as any).role !== 'SUPER_ADMIN';
  const userSiteId = (user as any).siteId;

  let filterSiteId: string | undefined;

  if (isSiteRestricted) {
    if (!userSiteId) {
         return apiSuccess({ odcs: [] });
    }
    filterSiteId = userSiteId;
  }

  const repo = getOdcRepository()
  const odcs = await repo.findAll(filterSiteId)
  return apiSuccess({ odcs })
}

export async function POST(req: Request) {
  const user = await getHybridUser(req)
  if (!user) return ApiErrors.unauthorized('Session tidak valid')

  if (!(await hasPermission("odc:create", user))) {
    return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat ODC')
  }
  const json = await req.json()
  const parsed = odcCreateSchema.safeParse(json)
  if (!parsed.success) {
    return apiError('Validasi gagal', ErrorCodes.VALIDATION_ERROR, { 
      status: 400, 
      details: { errors: parsed.error.flatten() } 
    })
  }
  const data = parsed.data

  const isSiteRestricted = (await hasPermission("odc:site_only", user)) && (user as any).role !== 'SUPER_ADMIN';
  const userSiteId = (user as any).siteId;

  if (isSiteRestricted) {
      if (!userSiteId) {
          return ApiErrors.forbidden('User tidak memiliki akses site')
      }
      data.siteId = userSiteId;
  }
  const repo = getOdcRepository()
  const created = await repo.create({
    name: data.name,
    images: data.images ?? [],
    location: data.location ?? null,
    notes: data.notes ?? null,
    keteranganJumlahKabelFeeder: data.keteranganJumlahKabelFeeder ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    otbCoreId: data.otbCoreId ?? null,
    siteId: data.siteId,
    outputs: data.outputs?.map((o, idx) => ({
      idx: o.idx ?? idx,
      slotName: o.slotName,
      redaman: o.redaman ?? null,
      tubeColor: o.tubeColor,
      coreColor: o.coreColor,
    })),
  })
  
  try {
    const { logger } = await import('@/lib/logger')
    if (user?.id) {
        await logger.logActivity({
        action: 'CREATE',
        subject: 'ODC',
        userId: user.id as string,
        details: { id: created.id, name: data.name }
        })
    }
  } catch (e) {
    console.error('Logging failed', e)
  }

  return apiSuccess({ id: created.id }, { status: 201, message: 'ODC berhasil dibuat' })
}
