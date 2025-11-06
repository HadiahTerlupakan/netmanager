import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getPoleRepository } from '@/lib/repositories'
import { poleCreateSchema } from '@/lib/validations/pole'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || session?.user?.role !== 'ADMIN') {
    return null
  }
  return session
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const repo = getPoleRepository()
  const poles = await repo.findAll()
  return NextResponse.json({ poles })
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const json = await req.json()
  const parsed = poleCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data
  const repo = getPoleRepository()
  const created = await repo.create({
    name: data.name,
    location: data.location ?? null,
    notes: data.notes ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    cableSlack: data.cableSlack ?? false,
  })
  return NextResponse.json({ id: created.id })
}


