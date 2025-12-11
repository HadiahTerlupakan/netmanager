import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getJoinboxRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import { joinboxUpdateSchema } from '@/lib/validations/joinbox'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const item = await prisma.joinbox.findUnique({
    where: { id },
    include: {
      inputs: { orderBy: { idx: 'asc' } },
      outputs: { orderBy: { idx: 'asc' } },
    },
  })
  if (!item) return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  return NextResponse.json({ joinbox: item })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const json = await req.json()
  const parsed = joinboxUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const repo = getJoinboxRepository()
  const { id } = await params
  await repo.update(id, parsed.data as any)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const repo = getJoinboxRepository()
  const { id } = await params
  await repo.delete(id)
  return NextResponse.json({ ok: true })
}


