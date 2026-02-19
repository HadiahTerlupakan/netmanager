import { getMixRadiusService } from '@/modules/integrations/services/MixRadiusService'
import { getUserPermissions, isSuperAdmin } from '@/lib/auth'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

export const dynamic = 'force-dynamic'

export const POST = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user
    const { id } = ctx.params

    const isSuper = isSuperAdmin(user)

    if (!isSuper) {
      const permissions = await getUserPermissions(user.id)
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
})
