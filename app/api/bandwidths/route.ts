import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { bandwidthSchema } from '@/lib/validations/bandwidth'
import { sanitizeInput } from '@/lib/utils/sanitize'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

/**
 * @swagger
 * /api/bandwidths:
 *   get:
 *     summary: Get all bandwidths
 *     description: Mengambil daftar semua bandwidth dengan filter opsional
 *     tags: [Bandwidth]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: ["AKTIF", "NONAKTIF"]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Daftar bandwidth berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Bandwidth'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function GET(req: NextRequest) {
  try {
    // Cek autentikasi menggunakan fungsi terpusat
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await hasPermission("bandwidth:read"))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const siteIdParam = searchParams.get('siteId')

    const where: any = {}
    if (status) {
      where.status = status
    }

    // Filter based on user role and parameter
    const user = session.user as any
    // If not super admin and has siteId, enforce restriction
    if (user.role !== 'SUPER_ADMIN' && user.siteId) {
      where.siteId = user.siteId
    } else if (siteIdParam) {
      // If super admin (or no site restriction) and param exists, use it
      where.siteId = siteIdParam
    }

    const bandwidths = await prisma.bandwidth.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { hargaPaket: true },
        },
      },
    })

    return NextResponse.json(bandwidths)
  } catch (error: any) {
    console.error('Error fetching bandwidths:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/bandwidths
 * Create new bandwidth - Membuat bandwidth baru
 */
export async function POST(req: NextRequest) {
  try {
    // Cek autentikasi admin menggunakan fungsi terpusat
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await hasPermission("bandwidth:create"))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const user = session.user as any

    // Determine siteId
    // If user is restricted, force their siteId
    // If user is Super Admin, take from body, otherwise null (Global) or error if we want strict
    let siteIdToSave = body.siteId
    if (user.role !== 'SUPER_ADMIN' && user.siteId) {
      siteIdToSave = user.siteId
    }

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
      siteId: siteIdToSave || null,
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

    // Hapus field undefined dari validation.data sebelum create
    const dataToCreate: any = {}
    Object.keys(validation.data).forEach(key => {
      if (validation.data[key as keyof typeof validation.data] !== undefined) {
        dataToCreate[key] = validation.data[key as keyof typeof validation.data]
      }
    })
    
    // Explicitly add siteId as it might not be in the Zod schema yet/validated separately
    if (siteIdToSave) {
        dataToCreate.siteId = siteIdToSave
    }

    const { randomUUID } = await import('crypto')
    
    const bandwidth = await prisma.bandwidth.create({
      data: {
        id: randomUUID(),
        updatedAt: new Date(),
        ...dataToCreate,
      },
    })

    // System Log
    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'CREATE',
        subject: 'Bandwidth',
        userId: session.user.id,
        details: { id: bandwidth.id, name: bandwidth.name, siteId: siteIdToSave }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    return NextResponse.json(bandwidth, { status: 201 })
  } catch (error: any) {
    console.error('Error creating bandwidth:', error)

    // Handle unique constraint violation
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
