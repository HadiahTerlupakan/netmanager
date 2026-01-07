import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { getOdcRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import { odcUpdateSchema } from '@/lib/validations/odc'
import { hasPermission } from '@/lib/rbac'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || false) {
    return null
  }
  return session
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Publik: memudahkan pemuatan form edit di client
  const { id } = await params
  const odc = await prisma.odc.findUnique({
    where: { id },
    include: {
      otbCore: { include: { otb: true } },
      odcOutput: {
        orderBy: { idx: 'asc' },
        include: { odp: { select: { id: true, name: true } } }
      },
    },
  })
  if (!odc) return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  if (!odc) return NextResponse.json({ error: 'Not Found' }, { status: 404 })

  // RBAC: Check site restrictions
  const session: any = await getServerSession(authConfig as any);
  const isSiteRestricted = session?.user && (await hasPermission("odc:site_only")) && session.user.role !== 'SUPER_ADMIN';
  const userSiteId = session?.user?.siteId;

  if (isSiteRestricted) {
    if (!userSiteId || (odc.siteId && odc.siteId !== userSiteId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  return NextResponse.json({ odc })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const json = await req.json()
  const parsed = odcUpdateSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

    // RBAC: Check site restrictions
  const isSiteRestricted = (await hasPermission("odc:site_only")) && session.user.role !== 'SUPER_ADMIN';
  const userSiteId = (session.user as any).siteId;

  const existingOdc = await prisma.odc.findUnique({ where: { id } });
  if (!existingOdc) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }

  if (isSiteRestricted) {
    if (!userSiteId || (existingOdc.siteId && existingOdc.siteId !== userSiteId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // Force siteId
    parsed.data.siteId = userSiteId;
  }
  const repo = getOdcRepository()
  const updateData: any = {
    ...(parsed.data.name !== undefined && { name: parsed.data.name }),
    ...(parsed.data.location !== undefined && { location: parsed.data.location }),
    ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
    ...(parsed.data.keteranganJumlahKabelFeeder !== undefined && { keteranganJumlahKabelFeeder: parsed.data.keteranganJumlahKabelFeeder }),
    ...(parsed.data.latitude !== undefined && { latitude: parsed.data.latitude }),
    ...(parsed.data.longitude !== undefined && { longitude: parsed.data.longitude }),
    ...(parsed.data.status !== undefined && { status: parsed.data.status }),
    ...(parsed.data.otbCoreId !== undefined && { otbCoreId: parsed.data.otbCoreId }),
    ...(parsed.data.siteId !== undefined && { siteId: parsed.data.siteId }),
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
      subject: 'ODC',
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
  const { id } = await params
  const repo = getOdcRepository()

  // Cek apakah ada ODP yang masih menggunakan output dari ODC ini
  const odc = await prisma.odc.findUnique({
    where: { id },
    include: { odcOutput: { include: { odp: true } } },
  })
  
  if (odc) {
      // RBAC: Check site restrictions
      const isSiteRestricted = (await hasPermission("odc:site_only")) && session.user.role !== 'SUPER_ADMIN';
      const userSiteId = (session.user as any).siteId;

      if (isSiteRestricted) {
        if (!userSiteId || (odc.siteId && odc.siteId !== userSiteId)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
  }

  if (!odc) {
    return NextResponse.json({ error: 'ODC tidak ditemukan' }, { status: 404 })
  }

  const odpsUsingOutputs = odc.odcOutput.filter(o => o.odp !== null).map(o => o.odp!.name)

  if (odpsUsingOutputs.length > 0) {
    const odpList = odpsUsingOutputs.join(', ')
    return NextResponse.json({
      error: `Tidak bisa menghapus ODC "${odc.name}" karena masih digunakan oleh ODP: ${odpList}. Hapus ODP tersebut terlebih dahulu.`
    }, { status: 409 })
  }

  try {
    await repo.delete(id)

    // System Log
    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'DELETE',
        subject: 'ODC',
        userId: session.user.id,
        details: { id, name: odc.name }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    // Foreign key constraint error
    if (e?.code === 'P2003') {
      return NextResponse.json({ error: 'Tidak bisa menghapus ODC selama masih ada data terkait (outputs/ODP).' }, { status: 409 })
    }
    throw e
  }
}


