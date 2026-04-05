import { createHandler, apiSuccess } from '@/lib/api'
import { acsSettingsSchema, type AcsSettingsInput } from '@/lib/validations/settings'
import { getAcsSettings, saveAcsSettings } from '@/modules/settings'

export const GET = createHandler({ auth: true, permissions: ['acs:read'] }, async () => {
  return apiSuccess(await getAcsSettings())
})

export const POST = createHandler<AcsSettingsInput>({
  auth: true,
  permissions: ['acs:update'],
  schema: acsSettingsSchema,
}, async (_req, ctx) => {
  await saveAcsSettings(ctx.validated, ctx.session?.user?.id)

  return apiSuccess({ success: true })
})
