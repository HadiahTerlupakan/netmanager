import { NextRequest } from 'next/server'
import { getMixRadiusService } from '@/modules/integrations/services/MixRadiusService'
import { verifyAuth, getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyAuth(req)
    if (!session) return ApiErrors.unauthorized()

    const { id } = await params

    // Permission check - require mixradius:delete permission
    const user = session as { id: string; role?: string; isSuperAdmin?: boolean }
    const isSuper = isSuperAdmin(user)

    if (!isSuper) {
      const permissions = await getUserPermissions(session.id)
      const hasAccess = permissions.includes('mixradius:delete') || permissions.includes('*')
      if (!hasAccess) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus data MixRadius')
      }
    }

    const service = getMixRadiusService()
    const success = await service.deleteIncomeRecord(id)

    if (success) {
      return apiSuccess({ success: true })
    } else {
      return ApiErrors.internalError('Gagal menghapus data di server MixRadius')
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return ApiErrors.internalError(message)
  }
}
