import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hargaPaketSchema } from '@/lib/validations/hargapaket'
import { sanitizeInput } from '@/lib/utils/sanitize'

/**
 * @swagger
 * /api/hargapakets/{id}:
 *   get:
 *     summary: Get harga paket by ID
 *     description: Mengambil detail harga paket berdasarkan ID
 *     tags: [HargaPaket]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Harga paket ID
 *     responses:
 *       200:
 *         description: Detail harga paket berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HargaPaket'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Harga paket tidak ditemukan
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
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const hargaPaket = await prisma.hargaPaket.findUnique({
      where: { id },
      include: {
        bandwidth: true,
        profilePPP: true,
      },
    })

    if (!hargaPaket) {
      return NextResponse.json({ error: 'Harga paket tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(hargaPaket)
  } catch (error: any) {
    console.error('Error fetching harga paket:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

/**
 * @swagger
 * /api/hargapakets/{id}:
 *   put:
 *     summary: Update harga paket
 *     description: Mengupdate data harga paket
 *     tags: [HargaPaket]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Harga paket ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Paket 10 Mbps"
 *                 description: Nama paket
 *               harga:
 *                 type: integer
 *                 example: 150000
 *                 description: Harga paket dalam Rupiah
 *               durasi:
 *                 type: integer
 *                 example: 1
 *                 description: Durasi paket
 *               durasiUnit:
 *                 type: string
 *                 enum: ["HARI", "MINGGU", "BULAN", "TAHUN"]
 *                 example: "BULAN"
 *                 description: Satuan durasi
 *               featured:
 *                 type: boolean
 *                 example: true
 *                 description: Apakah paket ditampilkan sebagai unggulan
 *               status:
 *                 type: string
 *                 enum: ["AKTIF", "NONAKTIF"]
 *                 example: "AKTIF"
 *                 description: Status paket
 *               bandwidthId:
 *                 type: string
 *                 nullable: true
 *                 example: "clx1234567890"
 *                 description: ID bandwidth (opsional)
 *               description:
 *                 type: string
 *                 nullable: true
 *                 example: "Paket internet 10 Mbps untuk rumahan"
 *                 description: Deskripsi paket
 *     responses:
 *       200:
 *         description: Harga paket berhasil diupdate
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HargaPaket'
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
 *         description: Harga paket tidak ditemukan
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
    const session: any = await getServerSession(authConfig as any)
    if (!session || false) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const { provider } = await params
    const body = await req.json()
    
    // Sanitize input
    const sanitizedBody = {
      ...body,
      name: body.name ? sanitizeInput(body.name) : undefined,
      bandwidthId: body.bandwidthId && body.bandwidthId.trim() ? body.bandwidthId : undefined, // Bandwidth opsional
      description: body.description ? sanitizeInput(body.description) : undefined,
    }

    const validation = hargaPaketSchema.safeParse(sanitizedBody)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // Pisahkan bandwidthId dari data untuk Prisma
    // bandwidthId opsional, jika null/undefined set ke null untuk update
    const { bandwidthId, ...prismaData } = validation.data
    const updateData: any = { ...prismaData }
    // Untuk update, jika bandwidthId tidak disediakan, set ke null untuk menghapus relasi
    updateData.bandwidthId = bandwidthId && bandwidthId.trim() !== '' ? bandwidthId : null

    const hargaPaket = await prisma.hargaPaket.update({
      where: { id },
      data: updateData,
      include: {
        bandwidth: true,
        profilePPP: {
          include: {
            mikroTikRouter: true,
          },
        },
      },
    })

    // Update rate limit di Profile PPP di MikroTik jika ada router
    // Rate limit akan diupdate jika bandwidthId berubah atau jika profile PPP memiliki router
    if (hargaPaket.profilePPP?.mikroTikRouterId && hargaPaket.profilePPP?.mikroTikRouter) {
      try {
        const { getRateLimitFromBandwidth, updatePPPProfileInMikroTik } = await import('@/lib/services/mikrotik-ppp-profile')
        const rateLimit = await getRateLimitFromBandwidth(hargaPaket.profilePPP.id)
        
        if (rateLimit) {
          console.log('[API HargaPaket] Updating rate limit in MikroTik:', rateLimit)
          const updateResult = await updatePPPProfileInMikroTik(
            hargaPaket.profilePPP.mikroTikRouterId,
            hargaPaket.profilePPP.name,
            {
              rateLimit: rateLimit, // Rate limit dari Bandwidth (format: "10M/10M")
            }
          )
          
          if (!updateResult.success) {
            console.error('[API HargaPaket] Failed to update rate limit in MikroTik:', updateResult.error)
            // Jangan gagalkan request, hanya log error
          } else {
            console.log('[API HargaPaket] Successfully updated rate limit in MikroTik')
          }
        }
      } catch (error: any) {
        console.error('[API HargaPaket] Error updating rate limit in MikroTik:', error)
        // Jangan gagalkan request, hanya log error
      }
    }

    return NextResponse.json(hargaPaket)
  } catch (error: any) {
    console.error('Error updating harga paket:', error)

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Harga paket tidak ditemukan' }, { status: 404 })
    }

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Nama paket sudah digunakan' },
        { status: 400 }
      )
    }

    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Bandwidth atau Profile PPP tidak ditemukan' },
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
 * /api/hargapakets/{id}:
 *   delete:
 *     summary: Delete harga paket
 *     description: Menghapus harga paket
 *     tags: [HargaPaket]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Harga paket ID
 *     responses:
 *       200:
 *         description: Harga paket berhasil dihapus
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Harga paket berhasil dihapus"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Harga paket tidak ditemukan
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
    const session: any = await getServerSession(authConfig as any)
    if (!session || false) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const { provider } = await params
    await prisma.hargaPaket.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Harga paket berhasil dihapus' })
  } catch (error: any) {
    console.error('Error deleting harga paket:', error)

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Harga paket tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

