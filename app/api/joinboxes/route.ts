import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getJoinboxRepository } from '@/lib/repositories'
import { joinboxCreateSchema } from '@/lib/validations/joinbox'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

export async function GET() {
  const repo = getJoinboxRepository()
  const items = await repo.findAll()
  return NextResponse.json({ items })
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const json = await req.json()
  const parsed = joinboxCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const repo = getJoinboxRepository()
  const created = await repo.create(parsed.data as any)
  return NextResponse.json({ id: created.id })
}


