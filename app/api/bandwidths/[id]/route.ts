import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { bandwidthSchema } from '@/lib/validations/bandwidth'
import { sanitizeInput } from '@/lib/utils/sanitize'

/**
 * @swagger
 * /api/bandwidths/{id}:
 *   get:
 *     summary: Get bandwidth by ID
 *     description: Mengambil detail bandwidth berdasarkan ID
 *     tags: [Bandwidth]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bandwidth ID
 *     responses:
 *       200:
 *         description: Detail bandwidth berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Bandwidth'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Bandwidth tidak ditemukan
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
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req)
    if (session instanceof NextResponse) {
      return session // Return error response if authentication fails
    }

    const { id } = await params
    const bandwidth = await prisma.bandwidth.findUnique({
      where: { id },
      include: {
        hargaPaket: {
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
 *     summary: Update bandwidth
 *     description: Mengupdate data bandwidth
 *     tags: [Bandwidth]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bandwidth ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "10 Mbps"
 *               maxLimitDownload:
 *                 type: string
 *                 example: "10M"
 *               maxLimitUpload:
 *                 type: string
 *                 example: "10M"
 *               burstLimitDownload:
 *                 type: string
 *                 nullable: true
 *                 example: "12M"
 *               burstLimitUpload:
 *                 type: string
 *                 nullable: true
 *                 example: "12M"
 *               minLimitDownload:
 *                 type: string
 *                 nullable: true
 *                 example: "5M"
 *               minLimitUpload:
 *                 type: string
 *                 nullable: true
 *                 example: "5M"
 *               burstThresholdDownload:
 *                 type: string
 *                 nullable: true
 *                 example: "8M"
 *               burstThresholdUpload:
 *                 type: string
 *                 nullable: true
 *                 example: "8M"
 *               burstTimeDownload:
 *                 type: number
 *                 nullable: true
 *                 example: 10
 *               burstTimeUpload:
 *                 type: number
 *                 nullable: true
 *                 example: 10
 *               priority:
 *                 type: number
 *                 nullable: true
 *                 example: 8
 *               description:
 *                 type: string
 *                 nullable: true
 *                 example: "Standard 10 Mbps package"
 *               status:
 *                 type: string
 *                 enum: ["AKTIF", "NONAKTIF"]
 *                 example: "AKTIF"
 *     responses:
 *       200:
 *         description: Bandwidth berhasil diupdate
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
 *       404:
 *         description: Bandwidth tidak ditemukan
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
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req)
    if (session instanceof NextResponse) {
      return session // Return error response if authentication fails
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
 *     summary: Delete bandwidth
 *     description: Menghapus bandwidth
 *     tags: [Bandwidth]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Bandwidth ID
 *     responses:
 *       200:
 *         description: Bandwidth berhasil dihapus
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Bandwidth berhasil dihapus"
 *       400:
 *         description: Bandwidth tidak dapat dihapus karena masih digunakan oleh paket
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
 *       404:
 *         description: Bandwidth tidak ditemukan
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
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req)
    if (session instanceof NextResponse) {
      return session // Return error response if authentication fails
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

