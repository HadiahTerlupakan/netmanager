import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getMikroTikRouterRepository } from '@/lib/repositories'
import { mikrotikRouterUpdateSchema } from '@/lib/validations/mikrotik'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || session?.user?.role !== 'ADMIN') {
    return null
  }
  return session
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await params
    const routerRepository = getMikroTikRouterRepository()
    const router = await routerRepository.findById(id)
    if (!router) {
      return NextResponse.json({ error: 'Router tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json({ router })
  } catch (error: any) {
    console.error('Error fetching MikroTik Router:', error)
    return NextResponse.json({ error: error.message || 'Gagal memuat data Router' }, { status: 500 })
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const json = await req.json()
  const parsed = mikrotikRouterUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data
  try {
    const routerRepository = getMikroTikRouterRepository()
    await routerRepository.update(id, {
      name: data.name,
      ipAddress: data.ipAddress,
      timezone: data.timezone,
      apiPort: data.apiPort,
      apiUsername: data.apiUsername,
      apiPassword: data.apiPassword,
      authPort: data.authPort,
      accountingPort: data.accountingPort,
      secretRadius: data.secretRadius,
      isolirUrl: data.isolirUrl,
      description: data.description,
    })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'Gagal mengupdate router atau IP Address sudah terpakai' }, { status: 409 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { id } = await params
    const routerRepository = getMikroTikRouterRepository()
    await routerRepository.delete(id)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: 'Gagal menghapus router' }, { status: 500 })
  }
}

