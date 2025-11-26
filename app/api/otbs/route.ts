import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOtbRepository } from '@/lib/repositories'
import { otbCreateSchema } from '@/lib/validations/otb'

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
  const repo = getOtbRepository()
  const otbs = await repo.findAll()
  return NextResponse.json({ otbs })
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const json = await req.json()
  const parsed = otbCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data
  const repo = getOtbRepository()
  const created = await repo.create({
    name: data.name,
    location: data.location ?? null,
    coreCount: data.coreCount,
    notes: data.notes ?? null,
    keteranganJumlahKabelFeeder: data.keteranganJumlahKabelFeeder ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    cores: data.cores?.map((c: any) => ({
      idx: c.idx,
      slotName: c.slotName,
      tubeColor: c.tubeColor,
      coreColor: c.coreColor,
    })),
  })
  return NextResponse.json({ id: created.id })
}


