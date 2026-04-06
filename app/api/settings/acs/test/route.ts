import { createHandler, apiSuccess } from '@/lib/api'
import { testAcsConnectivity } from '@/modules/settings'
import { acsTestUrlSchema, type AcsTestUrlInput } from '@/lib/validations/settings'

export const POST = createHandler<AcsTestUrlInput>({
  auth: true,
  permissions: ['acs:update'],
  schema: acsTestUrlSchema,
}, async (_req, ctx) => {
  const result = await testAcsConnectivity(ctx.validated.url)
  return apiSuccess(result)
})
