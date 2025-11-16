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
 *     tags: [HargaPaket]
 *     summary: Mendapatkan detail harga paket
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
 *     tags: [HargaPaket]
 *     summary: Update harga paket
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session || session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
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
 *     tags: [HargaPaket]
 *     summary: Hapus harga paket
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session || session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
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

