import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getOtbRepository } from '@/lib/repositories'
import { otbCreateSchema } from '@/lib/validations/otb'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await hasPermission("otb:read"))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const isSiteRestricted = (await hasPermission("otb:site_only")) && session.user.role !== 'SUPER_ADMIN';
  const userSiteId = (session.user as any).siteId;

  let filterSiteId: string | undefined;

  if (isSiteRestricted) {
    if (!userSiteId) {
         // User restricted but has no site
         return NextResponse.json({ otbs: [] });
    }
    filterSiteId = userSiteId;
  }

  const repo = getOtbRepository()
  const otbs = await repo.findAll(filterSiteId)
  return NextResponse.json({ otbs })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await hasPermission("otb:create"))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const json = await req.json()
  const parsed = otbCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data

  // RBAC: Check site restrictions
  const isSiteRestricted = (await hasPermission("otb:site_only")) && session.user.role !== 'SUPER_ADMIN';
  const userSiteId = (session.user as any).siteId;

  if (isSiteRestricted) {
      if (!userSiteId) {
          return NextResponse.json({ error: 'User tidak memiliki akses site' }, { status: 403 });
      }
      // Force siteId
      data.siteId = userSiteId;
  }
  const repo = getOtbRepository()
  const created = await repo.create({
    name: data.name,
    location: data.location ?? null,
    coreCount: data.coreCount,
    notes: data.notes ?? null,
    keteranganJumlahKabelFeeder: data.keteranganJumlahKabelFeeder ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    siteId: data.siteId,
    cores: data.cores?.map((c: any) => ({
      idx: c.idx,
      slotName: c.slotName,
      tubeColor: c.tubeColor,
      coreColor: c.coreColor,
    })),
  })

  // System Log
  try {
    const { logger } = await import('@/lib/logger')
    await logger.logActivity({
      action: 'CREATE',
      subject: 'OTB',
      userId: session.user.id as string,
      details: { id: created.id, name: parsed.data.name }
    })
  } catch (e) {
    console.error('Logging failed', e)
  }

  return NextResponse.json({ id: created.id })
}
