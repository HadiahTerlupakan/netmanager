import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getOdpRepository } from '@/lib/repositories'
import { odpCreateSchema } from '@/lib/validations/odp'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await hasPermission("odp:read"))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const isSiteRestricted = (await hasPermission("odp:site_only")) && session.user.role !== 'SUPER_ADMIN';
  const userSiteId = (session.user as any).siteId;

  let filterSiteId: string | undefined;

  if (isSiteRestricted) {
    if (!userSiteId) {
         // User restricted but has no site
         return NextResponse.json({ odps: [] });
    }
    filterSiteId = userSiteId;
  }

  const repo = getOdpRepository()
  const odps = await repo.findAll(filterSiteId)
  return NextResponse.json({ odps })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await hasPermission("odp:create"))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const json = await req.json()
  const parsed = odpCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data

  // RBAC: Check site restrictions
  const isSiteRestricted = (await hasPermission("odp:site_only")) && session.user.role !== 'SUPER_ADMIN';
  const userSiteId = (session.user as any).siteId;

  if (isSiteRestricted) {
      if (!userSiteId) {
          return NextResponse.json({ error: 'User tidak memiliki akses site' }, { status: 403 });
      }
      // Force siteId
      data.siteId = userSiteId;
  }
  const repo = getOdpRepository()
  const created = await repo.create({
    name: data.name,
    location: data.location ?? null,
    notes: data.notes ?? null,
    keteranganJumlahKabelFeeder: data.keteranganJumlahKabelFeeder ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    odcOutputId: data.odcOutputId,
    siteId: data.siteId, // Add siteId to creation
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
    // Get session again or reuse if available (POST in route.ts doesn't explicitly get session in the viewed snippet, wait)
    // Looking at odps/route.ts in view_file Step 357, I don't see `session` being retrieved.
    // Ah, Step 357 snippet starts at line 150.
    // I need to check if `session` is available in `POST`.
    // It imports `getServerSession`.
    // I'll assume I need to fetch it if not present, OR I CANNOT USE `session.user.id`.
    // Let's check `odps/route.ts` beginning.
    // I'll use a safe way.
    if (session?.user?.id) {
      await logger.logActivity({
        action: 'CREATE',
        subject: 'ODP',
        userId: session.user.id as string,
        details: { id: created.id, name: data.name }
      })
    }
  } catch (e) {
    console.error('Logging failed', e)
  }

  return NextResponse.json({ id: created.id })
}


