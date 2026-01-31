import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { bandwidthSchema } from '@/lib/validations/bandwidth'
import { sanitizeInput } from '@/lib/utils/sanitize'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return ApiErrors.unauthorized('Session tidak valid')
    }

    if (!(await hasPermission("bandwidth:read"))) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat bandwidth')
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const siteIdParam = searchParams.get('siteId')

    const where: { status?: string; siteId?: string } = {}
    if (status) {
      where.status = status
    }

    const user = session.user as { role: string; siteId?: string; id?: string }
    if (user.role !== 'SUPER_ADMIN' && user.siteId) {
      where.siteId = user.siteId
    } else if (siteIdParam) {
      where.siteId = siteIdParam
    }

    const bandwidths = await prisma.bandwidth.findMany({
      where: where as Prisma.BandwidthWhereInput,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { hargaPaket: true },
        },
      },
    })

    return apiSuccess(bandwidths)
  } catch (error: unknown) {
    console.error('Error fetching bandwidths:', error)
    const errorMessage = error instanceof Error ? error.message : 'Gagal mengambil data bandwidth'
    return ApiErrors.internalError(errorMessage)
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return ApiErrors.unauthorized('Session tidak valid')
    }

    if (!(await hasPermission("bandwidth:create"))) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat bandwidth')
    }

    const body = await req.json()
    const user = session.user as { role: string; siteId?: string; id?: string }

    let siteIdToSave = body.siteId
    if (user.role !== 'SUPER_ADMIN' && user.siteId) {
      siteIdToSave = user.siteId
    }

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
      siteId: siteIdToSave || null,
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

    const dataToCreate: Record<string, string | number | boolean | null> = {}
    Object.keys(validation.data).forEach(key => {
      if (validation.data[key as keyof typeof validation.data] !== undefined) {
        dataToCreate[key] = validation.data[key as keyof typeof validation.data] as string | number | boolean | null
      }
    })

    if (siteIdToSave) {
        dataToCreate.siteId = siteIdToSave
    }

    const { randomUUID } = await import('crypto')

    const bandwidth = await prisma.bandwidth.create({
      data: {
        id: randomUUID(),
        updatedAt: new Date(),
        ...dataToCreate,
      } as Prisma.BandwidthCreateInput,
    })

    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'CREATE',
        subject: 'Bandwidth',
        ...(session.user.id ? { userId: session.user.id } : {}),
        details: { id: bandwidth.id, name: bandwidth.name, siteId: siteIdToSave }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    return apiSuccess(bandwidth, { status: 201, message: 'Bandwidth berhasil dibuat' })
  } catch (error: unknown) {
    console.error('Error creating bandwidth:', error)

    const prismaError = error as { code?: string; message?: string }
    if (prismaError.code === 'P2002') {
      return apiError('Nama bandwidth sudah digunakan', ErrorCodes.CONFLICT, { status: 409 })
    }

    return ApiErrors.internalError(prismaError.message || 'Gagal membuat bandwidth')
  }
}
