import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hargaPaketSchema } from '@/lib/validations/hargapaket'
import { sanitizeInput } from '@/lib/utils/sanitize'

/**
 * @swagger
 * /api/hargapakets:
 *   get:
 *     tags: [HargaPaket]
 *     summary: Mendapatkan semua data harga paket
 *     responses:
 *       200:
 *         description: List harga paket
 */
export async function GET(req: NextRequest) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
 *     tags: [HargaPaket]
 *     summary: Membuat harga paket baru
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               bandwidthId:
 *                 type: string
 *               profilePPPId:
 *                 type: string
 *               harga:
 *                 type: number
 *               durasi:
 *                 type: number
 *               description:
 *                 type: string
 *               featured:
 *                 type: boolean
 *               status:
 *                 type: string
 *     responses:
 *       201:
 *         description: Harga paket berhasil dibuat
 */
export async function POST(req: NextRequest) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session || false) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
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
      data: createData,
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

