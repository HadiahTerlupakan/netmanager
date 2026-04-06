import { hasPermission } from '@/lib/rbac'
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'
import { getEmailSettings, updateEmailSettings, type EmailSettingsUpdatePayload } from '@/modules/settings'

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
    const tenantId = ctx.session!.user.tenantId

    if (!await hasPermission('email:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat pengaturan email')
    }

    const payload = await getEmailSettings(tenantId)
    return apiSuccess(payload)
})

export const PUT = createHandler({ auth: true }, async (req, ctx) => {
    const tenantId = ctx.session!.user.tenantId

    // Permission check
    if (!await hasPermission('email:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah pengaturan email')
    }

    const payload = (await req.json()) as EmailSettingsUpdatePayload
    await updateEmailSettings(tenantId, ctx.session!.user.id, payload)

    return apiSuccess(null, { message: 'Pengaturan email berhasil disimpan' })
})
