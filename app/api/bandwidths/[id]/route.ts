import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { bandwidthSchema } from '@/lib/validations/bandwidth'
import { sanitizeInput } from '@/lib/utils/sanitize'

/**
 * @swagger
 * /api/bandwidths/{id}:
 *   get:
 *     tags: [Bandwidth]
 *     summary: Mendapatkan detail bandwidth
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const bandwidth = await prisma.bandwidth.findUnique({
      where: { id },
      include: {
        hargaPakets: {
          include: {
            profilePPP: true,
          },
        },
      },
    })

    if (!bandwidth) {
      return NextResponse.json({ error: 'Bandwidth tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(bandwidth)
  } catch (error: any) {
    console.error('Error fetching bandwidth:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

/**
 * @swagger
 * /api/bandwidths/{id}:
 *   put:
 *     tags: [Bandwidth]
 *     summary: Update bandwidth
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session || false) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const body = await req.json()
    
    // Sanitize input
    const sanitizedBody: any = {
      name: body.name ? sanitizeInput(body.name) : undefined,
      maxLimitDownload: body.maxLimitDownload ? sanitizeInput(body.maxLimitDownload) : undefined,
      maxLimitUpload: body.maxLimitUpload ? sanitizeInput(body.maxLimitUpload) : undefined,
      burstLimitDownload: body.burstLimitDownload ? sanitizeInput(body.burstLimitDownload) : undefined,
      burstLimitUpload: body.burstLimitUpload ? sanitizeInput(body.burstLimitUpload) : undefined,
      minLimitDownload: body.minLimitDownload ? sanitizeInput(body.minLimitDownload) : undefined,
      minLimitUpload: body.minLimitUpload ? sanitizeInput(body.minLimitUpload) : undefined,
      burstThresholdDownload: body.burstThresholdDownload ? sanitizeInput(body.burstThresholdDownload) : undefined,
      burstThresholdUpload: body.burstThresholdUpload ? sanitizeInput(body.burstThresholdUpload) : undefined,
      burstTimeDownload: body.burstTimeDownload !== undefined && body.burstTimeDownload !== null ? Number(body.burstTimeDownload) : undefined,
      burstTimeUpload: body.burstTimeUpload !== undefined && body.burstTimeUpload !== null ? Number(body.burstTimeUpload) : undefined,
      priority: body.priority !== undefined && body.priority !== null ? Number(body.priority) : undefined,
      description: body.description ? sanitizeInput(body.description) : undefined,
      status: body.status || 'AKTIF',
    }

    // Hapus field yang undefined untuk menghindari masalah dengan Prisma
    Object.keys(sanitizedBody).forEach(key => {
      if (sanitizedBody[key] === undefined) {
        delete sanitizedBody[key]
      }
    })

    const validation = bandwidthSchema.safeParse(sanitizedBody)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // Hapus field undefined dari validation.data sebelum update
    const dataToUpdate: any = {}
    Object.keys(validation.data).forEach(key => {
      if (validation.data[key as keyof typeof validation.data] !== undefined) {
        dataToUpdate[key] = validation.data[key as keyof typeof validation.data]
      }
    })

    const bandwidth = await prisma.bandwidth.update({
      where: { id },
      data: dataToUpdate,
    })

    return NextResponse.json(bandwidth)
  } catch (error: any) {
    console.error('Error updating bandwidth:', error)

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Bandwidth tidak ditemukan' }, { status: 404 })
    }

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Nama bandwidth sudah digunakan' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

/**
 * @swagger
 * /api/bandwidths/{id}:
 *   delete:
 *     tags: [Bandwidth]
 *     summary: Hapus bandwidth
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session || false) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    await prisma.bandwidth.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Bandwidth berhasil dihapus' })
  } catch (error: any) {
    console.error('Error deleting bandwidth:', error)

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Bandwidth tidak ditemukan' }, { status: 404 })
    }

    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Bandwidth tidak dapat dihapus karena masih digunakan oleh paket' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

