import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOnuTypeRepository } from '@/lib/repositories'
import { onuTypeUpdateSchema } from '@/lib/validations/onutype'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const onuTypeRepository = getOnuTypeRepository()
  const onuType = await onuTypeRepository.findById(id)
  if (!onuType) {
    return NextResponse.json({ error: 'OnuType tidak ditemukan' }, { status: 404 })
  }
  return NextResponse.json({ onuType })
}

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await _req.json()
  const parsed = onuTypeUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const onuTypeRepository = getOnuTypeRepository()
  const data: any = {}
  if (parsed.data.name !== undefined) data.name = parsed.data.name
  if (parsed.data.ethernetPorts !== undefined) data.ethernetPorts = parsed.data.ethernetPorts
  if (parsed.data.wifi !== undefined) data.wifi = parsed.data.wifi
  if (parsed.data.voipPorts !== undefined) data.voipPorts = parsed.data.voipPorts

  try {
    await onuTypeRepository.update(id, data)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'Terjadi kesalahan saat mengupdate OnuType' }, { status: 409 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const onuTypeRepository = getOnuTypeRepository()
  await onuTypeRepository.delete(id)
  return NextResponse.json({ ok: true })
}

