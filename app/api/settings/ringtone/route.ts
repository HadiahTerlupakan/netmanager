import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { hasPermission } from '@/lib/rbac'
import { logActivitySafe } from '@/lib/logger'
import { ringtoneSettingsSchema, type RingtoneSettingsInput } from '@/lib/validations/settings'
import { getRingtoneSettings, saveRingtoneSettings, type RingtoneSettingsPayload } from '@/modules/settings'

export const dynamic = 'force-dynamic'

export const GET = createHandler({ auth: true }, async () => {
  if (!await hasPermission('nada_dering:read')) {
    return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat pengaturan nada dering')
  }

  return apiSuccess(await getRingtoneSettings())
})

export const POST = createHandler<RingtoneSettingsInput>({
  auth: true,
  schema: ringtoneSettingsSchema,
}, async (_req, ctx) => {
  if (!await hasPermission('nada_dering:update')) {
    return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah pengaturan nada dering')
  }

  const payload: RingtoneSettingsPayload = {
    enabled: ctx.validated.enabled,
    soundType: ctx.validated.soundType,
    customSoundData: ctx.validated.customSoundData ?? null,
    customSoundName: ctx.validated.customSoundName ?? null,
  }

  await saveRingtoneSettings(payload)

  if (ctx.session?.user?.id) {
    logActivitySafe({
      action: 'UPDATE',
      subject: 'Settings',
      userId: ctx.session.user.id,
      details: { type: 'Ringtone', updates: payload },
    })
  }

  return apiSuccess({ success: true })
})
