import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hargaPaketSchema } from '@/lib/validations/hargapaket'
import { sanitizeInput } from '@/lib/utils/sanitize'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

/**
 * @swagger
 * /api/hargapakets:
 *   get:
 *     summary: Get all harga pakets
 *     description: Mengambil daftar semua harga paket dengan filter opsional
 *     tags: [HargaPaket]
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
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *         description: Filter by featured status
 *     responses:
 *       200:
 *         description: Daftar harga paket berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/HargaPaket'
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

    if (!(await hasPermission("harga:read"))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const featured = searchParams.get('featured')

    const where: any = {}
    if (status) {
      where.status = status
    }
    if (featured !== null) {
      where.featured = featured === 'true'
    }

    const siteIdParam = searchParams.get('siteId')
    console.log('[API HargaPaket] Request params:', { status, featured, siteIdParam })
    
    if (siteIdParam) {
        where.profilePPP = {
            mikroTikRouter: {
                siteId: siteIdParam
            }
        }
        console.log('[API HargaPaket] Filtering by Site:', siteIdParam)
    }

    // SITE RESTRICTION LOGIC
    // We reuse session from above
    const isSiteRestricted = await hasPermission('harga:site_only') && session.user.role !== 'SUPER_ADMIN'
    
    if (isSiteRestricted) {
        const userSiteId = (session.user as any).siteId
        if (!userSiteId) {
             // Restricted but no site assigned -> No Access
             return NextResponse.json([])
        }
        where.profilePPP = {
            mikroTikRouter: {
                siteId: userSiteId
            }
        }
    }

    const hargaPakets = await prisma.hargaPaket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        bandwidth: true,
        profilePPP: true,
      },
    })

    return NextResponse.json(hargaPakets)
  } catch (error: any) {
    console.error('Error fetching harga pakets:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

/**
 * @swagger
 * /api/hargapakets:
 *   post:
 *     summary: Create new harga paket
 *     description: Membuat harga paket baru
 *     tags: [HargaPaket]
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
 *               - harga
 *               - durasi
 *               - profilePPPId
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Paket 10 Mbps"
 *                 description: Nama paket
 *               bandwidthId:
 *                 type: string
 *                 nullable: true
 *                 example: "clx1234567890"
 *                 description: ID bandwidth (opsional)
 *               profilePPPId:
 *                 type: string
 *                 example: "clx1234567890"
 *                 description: ID profile PPP
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
 *                 default: "BULAN"
 *                 example: "BULAN"
 *                 description: Satuan durasi
 *               description:
 *                 type: string
 *                 nullable: true
 *                 example: "Paket internet 10 Mbps untuk rumahan"
 *                 description: Deskripsi paket
 *               featured:
 *                 type: boolean
 *                 default: false
 *                 example: true
 *                 description: Apakah paket ditampilkan sebagai unggulan
 *               status:
 *                 type: string
 *                 enum: ["AKTIF", "NONAKTIF"]
 *                 default: "AKTIF"
 *                 example: "AKTIF"
 *                 description: Status paket
 *     responses:
 *       201:
 *         description: Harga paket berhasil dibuat
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
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Nama paket sudah digunakan
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
    // Cek autentikasi admin menggunakan fungsi terpusat
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await hasPermission("harga:create"))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
    // bandwidthId opsional, jika null/undefined jangan kirim ke Prisma
    const { bandwidthId, ...prismaData } = validation.data
    const createData: any = { ...prismaData }
    if (bandwidthId && bandwidthId.trim() !== '') {
      createData.bandwidthId = bandwidthId
    }

    const hargaPaket = await prisma.hargaPaket.create({
      data: {
        id: crypto.randomUUID(),
        updatedAt: new Date(),
        ...createData,
      },
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
    if (hargaPaket.profilePPP?.mikroTikRouterId && hargaPaket.profilePPP?.mikroTikRouter) {
      try {
        const { getRateLimitFromBandwidth, updatePPPProfileInMikroTik } = await import('@/modules/network/services/mikrotik-ppp-profile')
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

    // System Log
    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'CREATE',
        subject: 'Harga Paket',
        userId: session.user.id,
        details: { id: hargaPaket.id, name: hargaPaket.name, price: hargaPaket.harga }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    return NextResponse.json(hargaPaket, { status: 201 })
  } catch (error: any) {
    console.error('Error creating harga paket:', error)

    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Nama paket sudah digunakan' },
        { status: 400 }
      )
    }

    // Handle foreign key constraint violation
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

