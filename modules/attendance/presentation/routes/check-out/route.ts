import { createHandler } from '@/lib/api/handler'
import { apiSuccess, apiError } from '@/lib/api-response'
import { getAttendanceContainer } from '../../../application'
import { CheckOutRequest } from '../../../domain'

export const POST = createHandler({ auth: true }, async (req, ctx) => {
  const userId = ctx.session!.user.id
  const tenantId = ctx.session!.user.tenantId
  const body = await req.json()

  const container = getAttendanceContainer()

  const request = new CheckOutRequest({
    userId,
    tenantId,
    photoUrl: body.photoUrl,
    location: body.location,
    notes: body.notes,
    latitude: body.latitude,
    longitude: body.longitude,
    offlineTime: body.offlineTime,
    timezone: body.timezone,
    idempotencyKey: req.headers.get('Idempotency-Key') ?? undefined,
  })

  const result = await container.checkOutUseCase.execute(request)

  if (!result.success) {
    const error = result.error!
    const statusMap: Record<string, number> = {
      VALIDATION_ERROR: 400,
      NO_ACTIVE_SESSION: 404,
      OUTSIDE_GEOFENCE: 422,
    }
    return apiError(error.message, error.code, { status: statusMap[error.code] ?? 400 })
  }

  return apiSuccess({
    attendance: result.attendance,
    warning: result.warning,
  })
})
