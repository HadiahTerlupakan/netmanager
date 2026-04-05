import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { hasPermission } from '@/lib/rbac'
import { captchaSettingsSchema, type CaptchaSettingsInput } from '@/lib/validations/settings'
import { getCaptchaSettings, saveCaptchaSettings } from '@/modules/settings'

export const dynamic = 'force-dynamic'

// GET /api/settings/captcha
export const GET = createHandler({ auth: true }, async () => {
    if (!await hasPermission('captcha:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat pengaturan captcha')
    }

    return apiSuccess(await getCaptchaSettings())
})

// POST /api/settings/captcha
export const POST = createHandler<CaptchaSettingsInput>({
    auth: true,
    schema: captchaSettingsSchema,
}, async (_req, ctx) => {
    if (!await hasPermission('captcha:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah pengaturan captcha')
    }

    await saveCaptchaSettings(ctx.validated)

    return apiSuccess({ message: 'Settings saved successfully' })
})
