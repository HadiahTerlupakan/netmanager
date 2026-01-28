import { type NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { getOLTRepository } from '@/lib/repositories'
import { oltUpdateSchema } from '@/lib/validations/olt'
import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

/**
 * @swagger
 * /api/olts/{id}:
 *   get:
 *     summary: Get OLT by ID
 *     tags: [OLTs]
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(_req)
  if (session instanceof NextResponse) return session
  const { id } = await params
  const oltRepository = getOLTRepository()
  const olt = await oltRepository.findById(id)
  if (!olt) {
    return ApiErrors.notFound('OLT')
  }

  // RBAC: Check site restrictions
  const isSiteRestricted = (await hasPermission("olt:site_only")) && session.user.role !== 'SUPER_ADMIN';
  const userSiteId = (session.user as any).siteId;

  if (isSiteRestricted) {
    if (!userSiteId || (olt.siteId && olt.siteId !== userSiteId)) {
        return ApiErrors.forbidden('Anda tidak memiliki akses ke OLT ini')
    }
  }

  return apiSuccess({ olt })
}

/**
 * @swagger
 * /api/olts/{id}:
 *   patch:
 *     summary: Update OLT
 *     tags: [OLTs]
 */
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(_req)
  if (session instanceof NextResponse) return session
  const { id } = await params
  const body = await _req.json()
  const parsed = oltUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('Validasi gagal', ErrorCodes.VALIDATION_ERROR, { 
      status: 400, 
      details: { errors: parsed.error.flatten() } 
    })
  }
  const oltRepository = getOLTRepository()
  const data: any = {}
  if (parsed.data.name !== undefined) data.name = parsed.data.name
  if (parsed.data.ipAddress !== undefined) data.ipAddress = parsed.data.ipAddress
  if (parsed.data.type !== undefined) data.type = parsed.data.type
  if (parsed.data.version !== undefined) data.version = parsed.data.version
  if (parsed.data.temperature !== undefined) data.temperature = parsed.data.temperature
  if (parsed.data.connectedDevices !== undefined) data.connectedDevices = parsed.data.connectedDevices
  if (parsed.data.model !== undefined) data.model = parsed.data.model
  if (parsed.data.uptime !== undefined) data.uptime = parsed.data.uptime
  if (parsed.data.syncStatus !== undefined) data.syncStatus = parsed.data.syncStatus
  if (parsed.data.syncDate !== undefined) data.syncDate = parsed.data.syncDate ? new Date(parsed.data.syncDate) : null
  if (parsed.data.telnetConnected !== undefined) data.telnetConnected = parsed.data.telnetConnected
  if (parsed.data.snmpConnected !== undefined) data.snmpConnected = parsed.data.snmpConnected
  if (parsed.data.snmpCommunityWrite !== undefined) data.snmpCommunityWrite = parsed.data.snmpCommunityWrite
  if (parsed.data.snmpVersion !== undefined) data.snmpVersion = parsed.data.snmpVersion
  if (parsed.data.snmpPort !== undefined) data.snmpPort = parsed.data.snmpPort
  if (parsed.data.telnetUsername !== undefined) data.telnetUsername = parsed.data.telnetUsername
  if (parsed.data.telnetPassword !== undefined) data.telnetPassword = parsed.data.telnetPassword
  if (parsed.data.telnetPort !== undefined) data.telnetPort = parsed.data.telnetPort

  try {
     const existingOlt = await oltRepository.findById(id);
     if (!existingOlt) {
        return ApiErrors.notFound('OLT')
     }

     // RBAC: Check site restrictions
     const isSiteRestricted = (await hasPermission("olt:site_only")) && session.user.role !== 'SUPER_ADMIN';
     const userSiteId = (session.user as any).siteId;

     if (isSiteRestricted) {
        if (!userSiteId || (existingOlt.siteId && existingOlt.siteId !== userSiteId)) {
            return ApiErrors.forbidden('Anda tidak memiliki akses ke OLT ini')
        }
        // Force siteId to remain same or set to userSiteId
        data.siteId = userSiteId;
     }

    await oltRepository.update(id, data)

    // System Log
    try {
      const { logger } = await import('@/lib/logger')
      await logger.logActivity({
        action: 'UPDATE',
        subject: 'OLT',
        userId: session.user.id,
        details: { id, changes: parsed.data }
      })
    } catch (e) {
      console.error('Logging failed', e)
    }

    return apiSuccess(null, { message: 'OLT berhasil diperbarui' })
  } catch (e: any) {
    return apiError('IP Address sudah terpakai atau terjadi kesalahan', ErrorCodes.CONFLICT, { status: 409 })
  }
}

/**
 * @swagger
 * /api/olts/{id}:
 *   delete:
 *     summary: Delete OLT
 *     tags: [OLTs]
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin(_req)
  if (session instanceof NextResponse) return session
  const { id } = await params
  const oltRepository = getOLTRepository()
  const existingOlt = await oltRepository.findById(id);
  if (!existingOlt) {
      return ApiErrors.notFound('OLT')
  }

  // RBAC: Check site restrictions
  const isSiteRestricted = (await hasPermission("olt:site_only")) && session.user.role !== 'SUPER_ADMIN';
  const userSiteId = (session.user as any).siteId;

  if (isSiteRestricted) {
    if (!userSiteId || (existingOlt.siteId && existingOlt.siteId !== userSiteId)) {
        return ApiErrors.forbidden('Anda tidak memiliki akses ke OLT ini')
    }
  }

  await oltRepository.delete(id)

  // System Log
  try {
    const { logger } = await import('@/lib/logger')
    await logger.logActivity({
      action: 'DELETE',
      subject: 'OLT',
      userId: session.user.id,
      details: { id }
    })
  } catch (e) {
    console.error('Logging failed', e)
  }

  return apiSuccess(null, { message: 'OLT berhasil dihapus' })
}
