import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { bandwidthSchema } from '@/lib/validations/bandwidth'
import { sanitizeInput } from '@/lib/utils/sanitize'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req)
    if (session instanceof Response) {
      return ApiErrors.unauthorized('Session tidak valid')
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
      return ApiErrors.notFound('Bandwidth')
    }

    return apiSuccess(bandwidth)
  } catch (error: unknown) {
    console.error('Error fetching bandwidth:', error)
    const errorMessage = error instanceof Error ? error.message : 'Gagal mengambil data bandwidth'
    return ApiErrors.internalError(errorMessage)
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req)
    if (session instanceof Response) {
      return ApiErrors.unauthorized('Session tidak valid')
    }

    const { id } = await params
    const body = await req.json()

    const sanitizedBody: Record<string, string | number | boolean | undefined | null> = {
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

    Object.keys(sanitizedBody).forEach(key => {
      if (sanitizedBody[key] === undefined) {
        delete sanitizedBody[key]
      }
    })

    const validation = bandwidthSchema.safeParse(sanitizedBody)
    if (!validation.success) {
      return apiError('Validasi gagal', ErrorCodes.VALIDATION_ERROR, {
        status: 400,
        details: { errors: validation.error.flatten() }
      })
    }

    const dataToUpdate: Record<string, string | number | boolean | null> = {}
    Object.keys(validation.data).forEach(key => {
      if (validation.data[key as keyof typeof validation.data] !== undefined) {
        dataToUpdate[key] = validation.data[key as keyof typeof validation.data] as string | number | boolean | null
      }
    })

    const bandwidth = await prisma.bandwidth.update({
      where: { id },
      data: dataToUpdate,
    })

    // RADIUS Sync Hook
    try {
      const { RadiusSyncService } = await import('@/modules/network/services/radius-sync-service')
      const radiusSync = new RadiusSyncService()
      const mode = await radiusSync.getConnectionMode()
      if (mode === 'RADIUS') {
        const { RadiusRepository } = await import('@/modules/network/repositories/RadiusRepository')
        const radiusRepo = new RadiusRepository()
        await radiusRepo.syncBandwidthToRadius(id)
      }
    } catch (syncError) {
      console.error('[Bandwidth API] RADIUS sync error:', syncError)
    }

    return apiSuccess(bandwidth, { message: 'Bandwidth berhasil diperbarui' })
  } catch (error: unknown) {
    console.error('Error updating bandwidth:', error)

    const prismaError = error as { code?: string; message?: string }
    if (prismaError.code === 'P2025') {
      return ApiErrors.notFound('Bandwidth')
    }

    if (prismaError.code === 'P2002') {
      return apiError('Nama bandwidth sudah digunakan', ErrorCodes.CONFLICT, { status: 409 })
    }

    return ApiErrors.internalError(prismaError.message || 'Gagal memperbarui bandwidth')
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(req)
    if (session instanceof Response) {
      return ApiErrors.unauthorized('Session tidak valid')
    }

    const { id } = await params
    
    const bandwidth = await prisma.bandwidth.findUnique({
      where: { id },
      include: {
        hargaPaket: {
          select: { id: true, name: true }
        }
      }
    })

    if (!bandwidth) {
      return ApiErrors.notFound('Bandwidth')
    }

    if (bandwidth.hargaPaket && bandwidth.hargaPaket.length > 0) {
      const paketNames = bandwidth.hargaPaket.slice(0, 3).map(p => p.name).join(', ')
      const moreCount = bandwidth.hargaPaket.length > 3 ? ` dan ${bandwidth.hargaPaket.length - 3} lainnya` : ''
      return apiError(
        `Bandwidth "${bandwidth.name}" tidak dapat dihapus karena masih digunakan oleh ${bandwidth.hargaPaket.length} paket (${paketNames}${moreCount}). Hapus atau ubah bandwidth pada paket tersebut terlebih dahulu.`,
        ErrorCodes.CONFLICT,
        { status: 409 }
      )
    }

    await prisma.bandwidth.delete({
      where: { id },
    })

    return apiSuccess(null, { message: 'Bandwidth berhasil dihapus' })
  } catch (error: unknown) {
    console.error('Error deleting bandwidth:', error)

    const prismaError = error as { code?: string; message?: string }
    if (prismaError.code === 'P2025') {
      return ApiErrors.notFound('Bandwidth')
    }

    if (prismaError.code === 'P2003') {
      return apiError('Bandwidth tidak dapat dihapus karena masih digunakan oleh paket', ErrorCodes.CONFLICT, { status: 409 })
    }

    return ApiErrors.internalError(prismaError.message || 'Gagal menghapus bandwidth')
  }
}
