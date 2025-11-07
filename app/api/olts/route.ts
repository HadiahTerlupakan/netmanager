import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOLTRepository } from '@/lib/repositories'
import { oltCreateSchema } from '@/lib/validations/olt'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || session?.user?.role !== 'ADMIN') {
    return null
  }
  return session
}

export async function GET() {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const oltRepository = getOLTRepository()
    const olts = await oltRepository.findAll()
    return NextResponse.json({ olts })
  } catch (error: any) {
    console.error('Error fetching OLTs:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal memuat data OLT', olts: [] },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const json = await req.json()
  const parsed = oltCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data
  try {
    const oltRepository = getOLTRepository()
    const olt = await oltRepository.create({
      name: data.name,
      ipAddress: data.ipAddress,
      type: data.type,
      version: data.version ?? null,
      temperature: data.temperature ?? null,
      connectedDevices: data.connectedDevices ?? 0,
      model: data.model ?? null,
      uptime: data.uptime ?? null,
      syncStatus: data.syncStatus ?? '0',
      syncDate: data.syncDate ? new Date(data.syncDate) : null,
      telnetConnected: data.telnetConnected ?? false,
      snmpConnected: data.snmpConnected ?? false,
      snmpCommunityWrite: data.snmpCommunityWrite ?? 'public',
      snmpVersion: data.snmpVersion ?? '2',
      snmpPort: data.snmpPort ?? 161,
      telnetUsername: data.telnetUsername ?? 'zte',
      telnetPassword: data.telnetPassword,
      telnetPort: data.telnetPort ?? 23,
    })
    return NextResponse.json({ id: olt.id })
  } catch (e: any) {
    return NextResponse.json({ error: 'IP Address sudah terpakai atau terjadi kesalahan' }, { status: 409 })
  }
}

