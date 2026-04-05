import { createHandler, apiSuccess } from '@/lib/api'
import { acsWifiSecuritySchema, type AcsWifiSecurityInput } from '@/lib/validations/settings'
import { deleteAcsWifiSecurity, updateAcsWifiSecurity } from '@/modules/settings'

export const PUT = createHandler<AcsWifiSecurityInput>({
  auth: true,
  permissions: ['acs:update'],
  schema: acsWifiSecuritySchema,
}, async (_req, ctx) => {
  const id = ctx.params.id
  const updatedConfig = await updateAcsWifiSecurity(id, ctx.validated)
  return apiSuccess(updatedConfig)
})

export const DELETE = createHandler({ auth: true, permissions: ['acs:update'] }, async (req, ctx) => {
  const id = ctx.params.id
  await deleteAcsWifiSecurity(id)
  return apiSuccess({ success: true })
})
