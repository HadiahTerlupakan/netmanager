import { createHandler } from '@/lib/api/handler'
import { apiSuccess } from '@/lib/api-response'
import { getAttendanceContainer } from '../../../application'

export const GET = createHandler({ auth: true }, async (req, ctx) => {
  const userId = ctx.session!.user.id
  const tenantId = ctx.session!.user.tenantId

  const container = getAttendanceContainer()
  const result = await container.getCurrentStatusUseCase.execute(userId, tenantId)

  return apiSuccess(result)
})
