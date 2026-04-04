import { AttendanceService } from '@/modules/attendance'
import { validateDaysRange } from '@/lib/validation-utils'
import { createHandler, apiSuccess } from '@/lib/api'

export const dynamic = 'force-dynamic'

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const userId = ctx.session!.user.id
    const { searchParams } = req.nextUrl
    
    const days = validateDaysRange(searchParams.get('days'), 365, 30)

    const attendanceService = new AttendanceService()
    const result = await attendanceService.getAttendanceAnalytics(userId, days)

    return apiSuccess(result)
})
