import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { bandwidthSchema } from '@/lib/validations/bandwidth'
import { sanitizeInput } from '@/lib/utils/sanitize'

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
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const where: any = {}
    if (status) {
      where.status = status
    }

    const bandwidths = await prisma.bandwidth.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { hargaPakets: true },
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
 * @swagger
 * /api/bandwidths:
 *   post:
 *     summary: Create new bandwidth
 *     description: Membuat bandwidth baru
 *     tags: [Bandwidth]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - maxLimitDownload
 *               - maxLimitUpload
 *             properties:
 *               name:
 *                 type: string
 *                 example: "10 Mbps"
 *                 description: Nama bandwidth
 *               maxLimitDownload:
 *                 type: string
 *                 example: "10M"
 *                 description: Limit download maksimal
 *               maxLimitUpload:
 *                 type: string
 *                 example: "10M"
 *                 description: Limit upload maksimal
 *               burstLimitDownload:
 *                 type: string
 *                 nullable: true
 *                 example: "12M"
 *                 description: Burst limit download
 *               burstLimitUpload:
 *                 type: string
 *                 nullable: true
 *                 example: "12M"
 *                 description: Burst limit upload
 *               minLimitDownload:
 *                 type: string
 *                 nullable: true
 *                 example: "5M"
 *                 description: Limit download minimal
 *               minLimitUpload:
 *                 type: string
 *                 nullable: true
 *                 example: "5M"
 *                 description: Limit upload minimal
 *               burstThresholdDownload:
 *                 type: string
 *                 nullable: true
 *                 example: "8M"
 *                 description: Threshold untuk burst download
 *               burstThresholdUpload:
 *                 type: string
 *                 nullable: true
 *                 example: "8M"
 *                 description: Threshold untuk burst upload
 *               burstTimeDownload:
 *                 type: number
 *                 nullable: true
 *                 example: 10
 *                 description: Waktu burst download dalam detik
 *               burstTimeUpload:
 *                 type: number
 *                 nullable: true
 *                 example: 10
 *                 description: Waktu burst upload dalam detik
 *               priority:
 *                 type: number
 *                 nullable: true
 *                 example: 8
 *                 description: Prioritas bandwidth
 *               description:
 *                 type: string
 *                 nullable: true
 *                 example: "Standard 10 Mbps package"
 *                 description: Deskripsi bandwidth
 *               status:
 *                 type: string
 *                 enum: ["AKTIF", "NONAKTIF"]
 *                 default: "AKTIF"
 *                 example: "AKTIF"
 *                 description: Status bandwidth
 *     responses:
 *       201:
 *         description: Bandwidth berhasil dibuat
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Bandwidth'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Nama bandwidth sudah digunakan
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
export async function POST(req: NextRequest) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session || false) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

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

    // Hapus field undefined dari validation.data sebelum create
    const dataToCreate: any = {}
    Object.keys(validation.data).forEach(key => {
      if (validation.data[key as keyof typeof validation.data] !== undefined) {
        dataToCreate[key] = validation.data[key as keyof typeof validation.data]
      }
    })

    const bandwidth = await prisma.bandwidth.create({
      data: dataToCreate,
    })

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

