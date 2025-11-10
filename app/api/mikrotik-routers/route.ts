import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getMikroTikRouterRepository } from '@/lib/repositories'
import { mikrotikRouterCreateSchema } from '@/lib/validations/mikrotik'

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
    const routerRepository = getMikroTikRouterRepository()
    const routers = await routerRepository.findAll()
    return NextResponse.json({ routers })
  } catch (error: any) {
    console.error('Error fetching MikroTik Routers:', error)
    const errorMessage = error?.message || error?.toString() || 'Gagal memuat data Router'
    return NextResponse.json(
      { error: errorMessage, routers: [] },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const json = await req.json()
  const parsed = mikrotikRouterCreateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const data = parsed.data
  try {
    const routerRepository = getMikroTikRouterRepository()
    const router = await routerRepository.create({
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
    return NextResponse.json({ id: router.id })
  } catch (e: any) {
    return NextResponse.json({ error: 'IP Address sudah terpakai atau terjadi kesalahan' }, { status: 409 })
  }
}

