import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOtbRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import { otbUpdateSchema } from '@/lib/validations/otb'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || session?.user?.role !== 'ADMIN') {
    return null
  }
  return session
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  // GET dibuat publik agar form edit bisa memuat data tanpa isu cookie di fetch client
  const { id } = await params
  const otb = await prisma.otb.findUnique({
    where: { id },
    include: { cores: { orderBy: { idx: 'asc' } } },
  })
  if (!otb) return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  return NextResponse.json({ otb })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const json = await req.json()
  const parsed = otbUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const repo = getOtbRepository()
  const { id } = await params
  await repo.update(id, parsed.data as any)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const repo = getOtbRepository()
  const { id } = await params
  await repo.delete(id)
  return NextResponse.json({ ok: true })
}


