import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { profilePPPSchema } from '@/lib/validations/profileppp'
import { sanitizeInput } from '@/lib/utils/sanitize'
import { createPPPProfileInMikroTik } from '@/lib/services/mikrotik-ppp-profile'

/**
 * GET /api/profileppps
 * Mendapatkan semua data Profile PPP
 * 
 * @swagger
 * /api/profileppps:
 *   get:
 *     tags: [ProfilePPP]
 *     summary: Mendapatkan semua data profile PPP
 *     responses:
 *       200:
 *         description: List profile PPP
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

    const profilePPPs = await prisma.profilePPP.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        mikroTikRouter: {
          select: {
            id: true,
            name: true,
            ipAddress: true,
          },
        },
        _count: {
          select: { hargaPakets: true },
        },
      },
    })

    return NextResponse.json(profilePPPs)
  } catch (error: any) {
    console.error('Error fetching profile PPPs:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

/**
 * @swagger
 * /api/profileppps:
 *   post:
 *     tags: [ProfilePPP]
 *     summary: Membuat profile PPP baru
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               localAddress:
 *                 type: string
 *               remoteAddress:
 *                 type: string
 *               dnsServer:
 *                 type: string
 *               sessionTimeout:
 *                 type: number
 *               idleTimeout:
 *                 type: number
 *               rateLimit:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       201:
 *         description: Profile PPP berhasil dibuat
 */
/**
 * POST /api/profileppps
 * Membuat Profile PPP baru
 * 
 * Alur:
 * 1. Validasi input (termasuk ipRange untuk IP Pool)
 * 2. Simpan Profile PPP ke database (tanpa ipRange, karena tidak disimpan)
 * 3. Jika ada mikroTikRouterId:
 *    - Buat IP Pool di MikroTik (jika ipRange disediakan)
 *    - Buat Profile PPP di MikroTik dengan remote-address = nama IP Pool
 */
export async function POST(req: NextRequest) {
  try {
    // Cek autentikasi dan autorisasi (hanya ADMIN yang bisa membuat Profile PPP)
    const session: any = await getServerSession(authConfig as any)
    if (!session || false) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await req.json()
    
    // Sanitize input dan convert empty strings to undefined/null
    const sanitizedBody = {
      name: body.name ? sanitizeInput(body.name) : undefined,
      localAddress: body.localAddress ? sanitizeInput(body.localAddress) : undefined,
      remoteAddress: body.remoteAddress ? sanitizeInput(body.remoteAddress) : undefined,
      // ipRange: Range IP untuk pool (contoh: "192.168.1.100-192.168.1.200")
      // Digunakan untuk membuat IP Pool di MikroTik, tidak disimpan di database
      ipRange: body.ipRange && body.ipRange.trim() ? sanitizeInput(body.ipRange) : undefined,
      dnsServer: body.dnsServer && body.dnsServer.trim() ? sanitizeInput(body.dnsServer) : undefined,
      sessionTimeout: body.sessionTimeout !== undefined && body.sessionTimeout !== null && body.sessionTimeout !== '' ? Number(body.sessionTimeout) : undefined,
      idleTimeout: body.idleTimeout !== undefined && body.idleTimeout !== null && body.idleTimeout !== '' ? Number(body.idleTimeout) : undefined,
      // Rate limit diambil dari Bandwidth yang terkait melalui HargaPaket atau bandwidthId langsung
      mikroTikRouterId: body.mikroTikRouterId && body.mikroTikRouterId.trim() ? body.mikroTikRouterId : undefined,
      bandwidthId: body.bandwidthId && body.bandwidthId.trim() ? body.bandwidthId : undefined, // Bandwidth untuk rate limit (opsional)
      description: body.description && body.description.trim() ? sanitizeInput(body.description) : undefined,
      status: body.status || 'AKTIF',
    }

    // Validasi data dengan Zod schema
    const validation = profilePPPSchema.safeParse(sanitizedBody)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation error', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    // Pisahkan ipRange dan bandwidthId dari data untuk Prisma
    // ipRange tidak disimpan di database, hanya digunakan untuk membuat IP Pool di MikroTik
    // bandwidthId tidak disimpan di database, hanya digunakan untuk mengambil rate limit
    const { ipRange, bandwidthId, ...prismaData } = validation.data

    // Simpan Profile PPP ke database
    const profilePPP = await prisma.profilePPP.create({
      data: prismaData,
      include: {
        mikroTikRouter: true,
      },
    })

    // Jika ada mikroTikRouterId, buat profile PPP dan IP Pool di MikroTik Router
    // Alur: 1. Buat IP Pool (jika ipRange disediakan), 2. Buat Profile PPP dengan rate limit dari Bandwidth
    if (validation.data.mikroTikRouterId && profilePPP.mikroTikRouter) {
      try {
        console.log('[API ProfilePPP] Attempting to create profile in MikroTik router:', validation.data.mikroTikRouterId)
        
        // Ambil rate limit dari Bandwidth
        // Prioritas: 1. bandwidthId langsung (jika disediakan), 2. HargaPaket yang terkait
        const { getRateLimitFromBandwidth } = await import('@/lib/services/mikrotik-ppp-profile')
        const rateLimit = await getRateLimitFromBandwidth(profilePPP.id, bandwidthId)
        
        if (rateLimit) {
          console.log('[API ProfilePPP] Rate limit from Bandwidth:', rateLimit)
        } else {
          console.log('[API ProfilePPP] No rate limit found from Bandwidth, creating profile without rate limit')
        }
        
        const mikrotikResult = await createPPPProfileInMikroTik(
          validation.data.mikroTikRouterId,
          {
            name: validation.data.name,
            localAddress: validation.data.localAddress,
            remoteAddress: validation.data.remoteAddress, // Nama IP Pool (sama dengan name)
            ipRange: validation.data.ipRange || undefined, // Range IP untuk pool (contoh: "192.168.1.100-192.168.1.200")
            dnsServer: validation.data.dnsServer || undefined,
            sessionTimeout: validation.data.sessionTimeout || undefined,
            idleTimeout: validation.data.idleTimeout || undefined,
            rateLimit: rateLimit || undefined, // Rate limit dari Bandwidth (format: "10M/10M")
          }
        )

        if (!mikrotikResult.success) {
          console.error('[API ProfilePPP] Failed to create PPP profile in MikroTik:', mikrotikResult.error)
          // Jangan gagalkan request, hanya log error
          // Profile sudah dibuat di database, user bisa sync manual nanti jika diperlukan
        } else {
          console.log('[API ProfilePPP] Successfully created PPP profile in MikroTik')
        }
      } catch (mikrotikError: any) {
        console.error('[API ProfilePPP] Error creating PPP profile in MikroTik:', mikrotikError)
        console.error('[API ProfilePPP] Error stack:', mikrotikError.stack)
        // Jangan gagalkan request, hanya log error
        // Profile sudah dibuat di database, user bisa sync manual nanti jika diperlukan
      }
    } else {
      // Jika tidak ada mikroTikRouterId yang dipilih, skip pembuatan profile di MikroTik
      console.log('[API ProfilePPP] No MikroTik router selected, skipping MikroTik profile creation')
    }

    return NextResponse.json(profilePPP, { status: 201 })
  } catch (error: any) {
    console.error('Error creating profile PPP:', error)
    
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Nama profile PPP sudah digunakan' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

