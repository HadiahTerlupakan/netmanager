import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOtbRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import { otbUpdateSchema } from '@/lib/validations/otb'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
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
  
  // Cek apakah ada ODC yang masih menggunakan slot dari OTB ini
  const otb = await prisma.otb.findUnique({
    where: { id },
    include: { cores: true },
  })
  
  if (!otb) {
    return NextResponse.json({ error: 'OTB tidak ditemukan' }, { status: 404 })
  }
  
  // Cek setiap core apakah ada ODC yang menggunakan
  const coreIds = otb.cores.map((c: any) => c.id)
  const odcsUsingSlots = await (prisma as any).odc.findMany({
    where: { otbCoreId: { in: coreIds } },
    select: { name: true },
  })
  
  if (odcsUsingSlots.length > 0) {
    const odcList = odcsUsingSlots.map((o: { name: string }) => o.name).join(', ')
    return NextResponse.json({ 
      error: `Tidak bisa menghapus OTB "${otb.name}" karena masih digunakan oleh ODC: ${odcList}. Hapus ODC tersebut terlebih dahulu.` 
    }, { status: 409 })
  }
  
  try {
    await repo.delete(id)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    if (e?.code === 'P2003') {
      return NextResponse.json({ error: 'Tidak bisa menghapus OTB selama masih ada slot/relasi yang terhubung.' }, { status: 409 })
    }
    throw e
  }
}


