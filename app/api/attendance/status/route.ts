import { NextResponse } from 'next/server'

import { createHandler } from '@/lib/api'
import { AttendanceService } from '@/modules/attendance'

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
    const userId = ctx.session!.user.id
    const attendanceService = new AttendanceService()
    const status = await attendanceService.getCurrentAttendanceStatus(userId)

    return NextResponse.json({ success: true, data: status })
})
