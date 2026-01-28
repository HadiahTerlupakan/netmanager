import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getOLTRepository } from '@/lib/repositories'
import { oltCreateSchema } from '@/lib/validations/olt'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

/**
 * @swagger
 * /api/olts:
 *   get:
 *     summary: Get all OLTs
 *     tags: [OLTs]
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return ApiErrors.unauthorized('Session tidak valid')
    }

    if (!(await hasPermission("olt:read"))) {
      return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat OLT')
    }
    const isSiteRestricted = (await hasPermission("olt:site_only")) && session.user.role !== 'SUPER_ADMIN';
    const userSiteId = (session.user as any).siteId;

    let filterSiteId: string | undefined;

    if (isSiteRestricted) {
        if (!userSiteId) {
             // User restricted but has no site
             return apiSuccess({ olts: [] });
        }
        filterSiteId = userSiteId;
    }

    const oltRepository = getOLTRepository()
    const olts = await oltRepository.findAll(filterSiteId)
    return apiSuccess({ olts })
  } catch (error: any) {
    console.error('Error fetching OLTs:', error)
    return ApiErrors.internalError(error.message || 'Gagal memuat data OLT')
  }
}

/**
 * @swagger
 * /api/olts:
 *   post:
 *     summary: Create new OLT
 *     tags: [OLTs]
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return ApiErrors.unauthorized('Session tidak valid')
  }

  if (!(await hasPermission("olt:create"))) {
    return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat OLT')
  }

  const json = await req.json()
  const parsed = oltCreateSchema.safeParse(json)
  if (!parsed.success) {
    return apiError('Validasi gagal', ErrorCodes.VALIDATION_ERROR, { 
      status: 400, 
      details: { errors: parsed.error.flatten() } 
    })
  }
  const data = parsed.data
  
  // RBAC: Check site restrictions
  const isSiteRestricted = (await hasPermission("olt:site_only")) && session.user.role !== 'SUPER_ADMIN';
  const userSiteId = (session.user as any).siteId;
  
  if (isSiteRestricted) {
      if (!userSiteId) {
          return ApiErrors.forbidden('User tidak memiliki akses site')
      }
      // Force siteId
      data.siteId = userSiteId;
  }
  
  try {
    const oltRepository = getOLTRepository()
    const olt = await oltRepository.create({
      name: data.name,
      ipAddress: data.ipAddress,
      type: data.type,
      version: data.version ?? null,
      temperature: data.temperature ?? null,
      connectedDevices: data.connectedDevices ?? 0,
      model: data.model ?? null,
      uptime: data.uptime ?? null,
      syncStatus: data.syncStatus ?? '0',
      syncDate: data.syncDate ? new Date(data.syncDate) : null,
      telnetConnected: data.telnetConnected ?? false,
      snmpConnected: data.snmpConnected ?? false,
      snmpCommunityWrite: data.snmpCommunityWrite ?? 'public',
      snmpVersion: data.snmpVersion ?? '2',
      snmpPort: data.snmpPort ?? 161,
      telnetUsername: data.telnetUsername ?? 'zte',
      telnetPassword: data.telnetPassword,
      telnetPort: data.telnetPort ?? 23,
      siteId: data.siteId,
    })


    // System Log
    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'CREATE',
        subject: 'OLT',
        userId: session.user.id,
        details: { id: olt.id, name: data.name, ip: data.ipAddress }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    return apiSuccess({ id: olt.id }, { status: 201, message: 'OLT berhasil dibuat' })
  } catch (e: any) {
    return apiError('IP Address sudah terpakai atau terjadi kesalahan', ErrorCodes.CONFLICT, { status: 409 })
  }
}
