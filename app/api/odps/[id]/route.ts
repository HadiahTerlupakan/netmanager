import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOdpRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import { odpUpdateSchema } from '@/lib/validations/odp'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const odp = await prisma.odp.findUnique({
    where: { id },
    include: { odcOutput: { include: { odc: true } }, odpOutput: { orderBy: { idx: 'asc' } } },
  })
  if (!odp) return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  return NextResponse.json({ odp })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const json = await req.json()
  const parsed = odpUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { id } = await params
  const repo = getOdpRepository()
  const updateData: any = {
    ...(parsed.data.name !== undefined && { name: parsed.data.name }),
    ...(parsed.data.location !== undefined && { location: parsed.data.location }),
    ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
    ...(parsed.data.keteranganJumlahKabelFeeder !== undefined && { keteranganJumlahKabelFeeder: parsed.data.keteranganJumlahKabelFeeder }),
    ...(parsed.data.latitude !== undefined && { latitude: parsed.data.latitude }),
    ...(parsed.data.longitude !== undefined && { longitude: parsed.data.longitude }),
    ...(parsed.data.status !== undefined && { status: parsed.data.status }),
    ...(parsed.data.odcOutputId !== undefined && { odcOutputId: parsed.data.odcOutputId }),
    ...(parsed.data.outputs !== undefined && {
      outputs: parsed.data.outputs.map((o, idx) => ({
        idx: o.idx ?? idx,
        slotName: o.slotName,
        redaman: o.redaman ?? null,
        tubeColor: o.tubeColor,
        coreColor: o.coreColor,
      })),
    }),
  }
  await repo.update(id, updateData)

  // System Log
  try {
    const { logger } = await import('@/lib/logger')
    await logger.logActivity({
      action: 'UPDATE',
      subject: 'ODP',
      userId: session.user.id,
      details: { id, updates: parsed.data }
    })
  } catch (e) {
    console.error('Logging failed', e)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const repo = getOdpRepository()
  const { id } = await params

  // Cek apakah ada output yang masih terhubung (jika ada relasi lain di masa depan)
  const odp = await prisma.odp.findUnique({
    where: { id },
    include: { odpOutput: true },
  })

  if (!odp) {
    return NextResponse.json({ error: 'ODP tidak ditemukan' }, { status: 404 })
  }

  // ODP saat ini tidak punya relasi ke data lain selain outputs yang akan ikut terhapus
  // Tapi kita tetap cek untuk konsistensi
  if (odp.odpOutput.length > 0) {
    // Output akan ikut terhapus dengan cascade, jadi tidak perlu block
    // Tapi karena kita pakai Restrict, mungkin perlu handle ini
  }

  try {
    await repo.delete(id)

    // System Log
    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'DELETE',
        subject: 'ODP',
        userId: session.user.id,
        details: { id, name: odp.name }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e?.code === 'P2003') {
      return NextResponse.json({ error: 'Tidak bisa menghapus ODP selama masih ada output terkait.' }, { status: 409 })
    }
    throw e
  }
}


