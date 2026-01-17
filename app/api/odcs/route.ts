import { NextResponse } from 'next/server'
import { getHybridUser } from '@/lib/hybrid-auth'
import { hasPermission } from '@/lib/rbac'
import { getOdcRepository } from '@/lib/repositories'
import { odcCreateSchema } from '@/lib/validations/odc'

export async function GET(req: Request) {
  const user = await getHybridUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await hasPermission("odc:read", user))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const isSiteRestricted = (await hasPermission("odc:site_only", user)) && (user as any).role !== 'SUPER_ADMIN';
  const userSiteId = (user as any).siteId;

  let filterSiteId: string | undefined;

  if (isSiteRestricted) {
    if (!userSiteId) {
         // User restricted but has no site
         return NextResponse.json({ odcs: [] });
    }
    filterSiteId = userSiteId;
  }

  const repo = getOdcRepository()
  const odcs = await repo.findAll(filterSiteId)
  return NextResponse.json({ odcs })
}

export async function POST(req: Request) {
  const user = await getHybridUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await hasPermission("odc:create", user))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const json = await req.json()
  const parsed = odcCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data

  // RBAC: Check site restrictions
  const isSiteRestricted = (await hasPermission("odc:site_only", user)) && (user as any).role !== 'SUPER_ADMIN';
  const userSiteId = (user as any).siteId;

  if (isSiteRestricted) {
      if (!userSiteId) {
          return NextResponse.json({ error: 'User tidak memiliki akses site' }, { status: 403 });
      }
      // Force siteId
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
  // System Log
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

  return NextResponse.json({ id: created.id })
}


