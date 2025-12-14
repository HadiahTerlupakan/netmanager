import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getPoleRepository } from '@/lib/repositories'
import { poleUpdateSchema } from '@/lib/validations/pole'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const repo = getPoleRepository()
  const item = await repo.findById(id)
  if (!item) return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  return NextResponse.json({ pole: item })
}

  export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const json = await req.json()
  const parsed = poleUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { id } = await ctx.params
  const repo = getPoleRepository()
  try {
    await repo.update(id, parsed.data)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    const code = err?.code || err?.name
    if (code === 'P2025') {
      return NextResponse.json({ error: 'Pole tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json({ error: err?.message || 'Gagal memperbarui' }, { status: 500 })
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const json = await req.json()
  const parsed = poleUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { id } = await ctx.params
  const repo = getPoleRepository()
  try {
    await repo.update(id, parsed.data)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    const code = err?.code || err?.name
    if (code === 'P2025') {
      return NextResponse.json({ error: 'Pole tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json({ error: err?.message || 'Gagal memperbarui' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  const repo = getPoleRepository()
  try {
    await repo.delete(id)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    const code = err?.code || err?.name
    if (code === 'P2025') {
      return NextResponse.json({ error: 'Pole tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json({ error: err?.message || 'Gagal menghapus' }, { status: 500 })
  }
}


