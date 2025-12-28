import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getPoleRepository } from '@/lib/repositories'
import { poleCreateSchema } from '@/lib/validations/pole'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await hasPermission("ftth:read"))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const repo = getPoleRepository()
  const poles = await repo.findAll()
  return NextResponse.json({ poles })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await hasPermission("ftth:create"))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const json = await req.json()
  const parsed = poleCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data
  const repo = getPoleRepository()
  const created = await repo.create(parsed.data as any)

  // System Log
  try {
    const { logger } = await import('@/lib/logger')
    await logger.logActivity({
      action: 'CREATE',
      subject: 'Pole',
      userId: session.user.id as string,
      details: { id: created.id, name: parsed.data.name }
    })
  } catch (e) {
    console.error('Logging failed', e)
  }

  return NextResponse.json({ id: created.id })
}
