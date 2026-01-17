import { NextResponse } from 'next/server'
import { getHybridUser } from '@/lib/hybrid-auth'
import { hasPermission } from '@/lib/rbac'
import { getPoleRepository } from '@/lib/repositories'
import { poleCreateSchema } from '@/lib/validations/pole'

export async function GET(req: Request) {
  const user = await getHybridUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await hasPermission("pole:read", user))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const isSiteRestricted = (await hasPermission("pole:site_only", user)) && (user as any).role !== 'SUPER_ADMIN';
  const userSiteId = (user as any).siteId;

  let filterSiteId: string | undefined;

  if (isSiteRestricted) {
    if (!userSiteId) {
         // User restricted but has no site
         return NextResponse.json({ poles: [] });
    }
    filterSiteId = userSiteId;
  }

  const repo = getPoleRepository()
  const poles = await repo.findAll(filterSiteId)
  return NextResponse.json({ poles })
}

export async function POST(req: Request) {
  const user = await getHybridUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await hasPermission("pole:create", user))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const json = await req.json()
  const parsed = poleCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data

  // RBAC: Check site restrictions
  const isSiteRestricted = (await hasPermission("pole:site_only", user)) && (user as any).role !== 'SUPER_ADMIN';
  const userSiteId = (user as any).siteId;

  if (isSiteRestricted) {
      if (!userSiteId) {
          return NextResponse.json({ error: 'User tidak memiliki akses site' }, { status: 403 });
      }
      // Force siteId
      data.siteId = userSiteId;
  }
  const repo = getPoleRepository()
  const created = await repo.create(parsed.data as any)

  // System Log
  try {
    const { logger } = await import('@/lib/logger')
    if (user?.id) {
        await logger.logActivity({
        action: 'CREATE',
        subject: 'Pole',
        userId: user.id as string,
        details: { id: created.id, name: parsed.data.name }
        })
    }
  } catch (e) {
    console.error('Logging failed', e)
  }

  return NextResponse.json({ id: created.id })
}
