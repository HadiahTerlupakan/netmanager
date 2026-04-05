import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'
import { acsWifiSecuritySchema, type AcsWifiSecurityInput } from '@/lib/validations/settings'
import { listAcsWifiSecurityConfigs, upsertAcsWifiSecurity } from '@/modules/settings'

export const GET = createHandler({ auth: true, permissions: ['acs:read'] }, async () => {
  return apiSuccess(await listAcsWifiSecurityConfigs())
})

export const POST = createHandler<AcsWifiSecurityInput>({
  auth: true,
  permissions: ['acs:update'],
  schema: acsWifiSecuritySchema,
}, async (_req, ctx) => {
  const tenantId = ctx.session?.user?.tenantId ?? null

  if (!tenantId) {
    return ApiErrors.badRequest('Tenant tidak valid')
  }

  return apiSuccess(await upsertAcsWifiSecurity(ctx.validated, tenantId))
})
