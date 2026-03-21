import { AttendanceService } from '@/modules/attendance/services/AttendanceService'
import { createHandler, apiSuccess, ApiErrors } from '@/lib/api'

export const dynamic = 'force-dynamic'

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const userId = ctx.session!.user.id
    const attendanceService = new AttendanceService()

    try {
        const config = await attendanceService.getAttendanceConfig(userId)
        return apiSuccess(config)
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
            return ApiErrors.notFound('User tidak ditemukan')
        }
        throw error
    }
})
