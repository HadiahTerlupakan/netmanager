import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOLTRepository } from '@/lib/repositories'
import { oltUpdateSchema } from '@/lib/validations/olt'

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
  const oltRepository = getOLTRepository()
  const olt = await oltRepository.findById(id)
  if (!olt) {
    return NextResponse.json({ error: 'OLT tidak ditemukan' }, { status: 404 })
  }
  return NextResponse.json({ olt })
}

export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await _req.json()
  const parsed = oltUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const oltRepository = getOLTRepository()
  const data: any = {}
  if (parsed.data.name !== undefined) data.name = parsed.data.name
  if (parsed.data.ipAddress !== undefined) data.ipAddress = parsed.data.ipAddress
  if (parsed.data.type !== undefined) data.type = parsed.data.type
  if (parsed.data.version !== undefined) data.version = parsed.data.version
  if (parsed.data.temperature !== undefined) data.temperature = parsed.data.temperature
  if (parsed.data.connectedDevices !== undefined) data.connectedDevices = parsed.data.connectedDevices
  if (parsed.data.model !== undefined) data.model = parsed.data.model
  if (parsed.data.uptime !== undefined) data.uptime = parsed.data.uptime
  if (parsed.data.syncStatus !== undefined) data.syncStatus = parsed.data.syncStatus
  if (parsed.data.syncDate !== undefined) data.syncDate = parsed.data.syncDate ? new Date(parsed.data.syncDate) : null
  if (parsed.data.telnetConnected !== undefined) data.telnetConnected = parsed.data.telnetConnected
  if (parsed.data.snmpConnected !== undefined) data.snmpConnected = parsed.data.snmpConnected
  if (parsed.data.snmpCommunityWrite !== undefined) data.snmpCommunityWrite = parsed.data.snmpCommunityWrite
  if (parsed.data.snmpVersion !== undefined) data.snmpVersion = parsed.data.snmpVersion
  if (parsed.data.snmpPort !== undefined) data.snmpPort = parsed.data.snmpPort
  if (parsed.data.telnetUsername !== undefined) data.telnetUsername = parsed.data.telnetUsername
  if (parsed.data.telnetPassword !== undefined) data.telnetPassword = parsed.data.telnetPassword
  if (parsed.data.telnetPort !== undefined) data.telnetPort = parsed.data.telnetPort

  try {
    await oltRepository.update(id, data)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'IP Address sudah terpakai atau terjadi kesalahan' }, { status: 409 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const oltRepository = getOLTRepository()
  await oltRepository.delete(id)
  return NextResponse.json({ ok: true })
}

