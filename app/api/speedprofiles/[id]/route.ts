import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getSpeedProfileRepository } from '@/lib/repositories'
import { speedProfileUpdateSchema } from '@/lib/validations/speedprofile'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || session?.user?.role !== 'ADMIN') {
    return null
  }
  return session
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const speedProfileRepository = getSpeedProfileRepository()
  const speedProfile = await speedProfileRepository.findById(id)
  if (!speedProfile) {
    return NextResponse.json({ error: 'SpeedProfile tidak ditemukan' }, { status: 404 })
  }
  return NextResponse.json({ speedProfile })
}

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await _req.json()
  const parsed = speedProfileUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const speedProfileRepository = getSpeedProfileRepository()
  const data: any = {}
  if (parsed.data.profileType !== undefined) data.profileType = parsed.data.profileType
  if (parsed.data.name !== undefined) data.name = parsed.data.name
  if (parsed.data.type !== undefined) data.type = parsed.data.type
  if (parsed.data.bandwidthSir !== undefined) data.bandwidthSir = parsed.data.bandwidthSir
  if (parsed.data.burstPir !== undefined) data.burstPir = parsed.data.burstPir
  if (parsed.data.fixed !== undefined) data.fixed = parsed.data.fixed
  if (parsed.data.assured !== undefined) data.assured = parsed.data.assured
  if (parsed.data.maximum !== undefined) data.maximum = parsed.data.maximum

  try {
    await speedProfileRepository.update(id, data)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengupdate SpeedProfile' }, { status: 409 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const speedProfileRepository = getSpeedProfileRepository()
  await speedProfileRepository.delete(id)
  return NextResponse.json({ ok: true })
}

