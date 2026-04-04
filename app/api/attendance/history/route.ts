import { AttendanceService } from '@/modules/attendance'
import { createHandler, apiPaginated } from '@/lib/api'

export const dynamic = 'force-dynamic'

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const userId = ctx.session!.user.id
    const { searchParams } = req.nextUrl
    
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    const attendanceService = new AttendanceService()
    const result = await attendanceService.getAttendanceHistory(userId, { page, limit })

    return apiPaginated(result.attendances, {
        page: result.pagination.page,
        limit: result.pagination.limit,
        total: result.pagination.total
    })
})
