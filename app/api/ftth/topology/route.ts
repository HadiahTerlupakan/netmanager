import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getKmzRepository } from '@/lib/repositories'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || session?.user?.role !== 'ADMIN') {
    return null
  }
  return session
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Ambil semua OTB dengan koordinat
    const otbs = await prisma.otb.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        name: true,
        location: true,
        latitude: true,
        longitude: true,
        notes: true,
      },
    })

    // Ambil semua ODC dengan relasi ke OTB
    const odcs = await prisma.odc.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        name: true,
        location: true,
        latitude: true,
        longitude: true,
        notes: true,
        otbCore: {
          select: {
            coreColor: true,
            tubeColor: true,
            otb: {
              select: {
                id: true,
                name: true,
                latitude: true,
                longitude: true,
              },
            },
          },
        },
      },
    })

    // Ambil semua ODP dengan relasi ke ODC
    const odps = await prisma.odp.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        name: true,
        location: true,
        latitude: true,
        longitude: true,
        notes: true,
        odcOutput: {
          select: {
            coreColor: true,
            tubeColor: true,
            odc: {
              select: {
                id: true,
                name: true,
                latitude: true,
                longitude: true,
              },
            },
          },
        },
      },
    })

    // Ambil semua Joinbox dengan koordinat
    const joinboxes = await prisma.joinbox.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        name: true,
        location: true,
        latitude: true,
        longitude: true,
        notes: true,
      },
    })

    // Ambil semua Pole dengan koordinat
    const poles = await prisma.pole.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        name: true,
        location: true,
        latitude: true,
        longitude: true,
        notes: true,
        cableSlack: true,
      },
    })

    // Ambil semua Pelanggan yang memiliki koordinat dan ODP
    const pelanggans = await prisma.pelanggan.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        odpId: { not: null },
      },
      select: {
        id: true,
        idPelanggan: true,
        nama: true,
        latitude: true,
        longitude: true,
        alamat: true,
        status: true,
        odpId: true,
        odp: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    })

    // Ambil semua KMZ files yang aktif
    const kmzRepository = getKmzRepository()
    const kmzFiles = await kmzRepository.findActive()

    return NextResponse.json({
      otbs,
      odcs,
      odps,
      joinboxes,
      poles,
      pelanggans,
      kmzFiles,
    })
  } catch (error: any) {
    console.error('Error fetching topology data:', error)
    return NextResponse.json({ error: 'Failed to fetch topology data' }, { status: 500 })
  }
}

