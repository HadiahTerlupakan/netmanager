import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOdcRepository } from '@/lib/repositories'
import { odcCreateSchema } from '@/lib/validations/odc'

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
  const repo = getOdcRepository()
  const odcs = await repo.findAll()
  return NextResponse.json({ odcs })
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const json = await req.json()
  const parsed = odcCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data
  const repo = getOdcRepository()
  const created = await repo.create({
    name: data.name,
    location: data.location ?? null,
    notes: data.notes ?? null,
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    otbCoreId: data.otbCoreId,
    outputs: data.outputs?.map((o, idx) => ({
      idx: o.idx ?? idx,
      slotName: o.slotName,
      redaman: o.redaman ?? null,
      tubeColor: o.tubeColor,
      coreColor: o.coreColor,
    })),
  })
  return NextResponse.json({ id: created.id })
}


