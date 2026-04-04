import { NextResponse } from 'next/server'

import { createHandler } from '@/lib/api'
import { prisma } from '@/modules/database'
import { AttendanceService, AttendanceTimezoneService, HolidayRepository } from '@/modules/attendance'
import { isOffDayForUser } from '@/modules/attendance'

type MobileTodayMetadata = {
    isHoliday: boolean
    holidayName: string | null
    isOffDay: boolean
    isTukarLiburWorkDay: boolean
    isTukarLiburLeaveDay: boolean
}

function isSameDay(date1: Date, date2: Date): boolean {
    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    )
}

async function getTodayMetadata(userId: string, tenantId: string): Promise<MobileTodayMetadata> {
    const holidayRepo = new HolidayRepository()
    const timezoneService = new AttendanceTimezoneService()

    // Use tenant timezone for accurate day-of-week calculation
    const tz = await timezoneService.getTimezone(tenantId)
    const { now: todayInTz, startOfDay: todayStart } = timezoneService.getEffectiveDate(tz)
    const todayEnd = new Date(todayStart)
    todayEnd.setHours(23, 59, 59, 999)

    const [holidayInfo, userData, tukarLibur] = await Promise.all([
        holidayRepo.isHoliday(todayStart, tenantId),
        prisma.user.findFirst({
            where: { id: userId, tenantId },
            select: {
                workDays: true,
                workingHourMode: true
            }
        }),
        prisma.leaveRequest.findFirst({
            where: {
                userId,
                tenantId,
                type: 'TUKAR_LIBUR',
                status: 'APPROVED',
                OR: [
                    { startDate: { gte: todayStart, lte: todayEnd } },
                    { replacementDate: { gte: todayStart, lte: todayEnd } }
                ]
            }
        })
    ])

    // Use timezone-aware day-of-week
    const dayOfWeek = todayInTz.getDay()

    let isOffDay = isOffDayForUser(dayOfWeek, userData?.workDays ?? null, userData?.workingHourMode ?? null)

    const isTukarLiburWorkDay = Boolean(
        tukarLibur?.replacementDate && isSameDay(new Date(tukarLibur.replacementDate), todayStart)
    )
    const isTukarLiburLeaveDay = Boolean(
        tukarLibur?.startDate && isSameDay(new Date(tukarLibur.startDate), todayStart)
    )

    if (isTukarLiburWorkDay) {
        isOffDay = false
    }

    if (isTukarLiburLeaveDay) {
        isOffDay = true
    }

    return {
        isHoliday: holidayInfo.isHoliday,
        holidayName: holidayInfo.holiday?.description ?? null,
        isOffDay,
        isTukarLiburWorkDay,
        isTukarLiburLeaveDay
    }
}

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
    const userId = ctx.session!.user.id
    const tenantId = ctx.session!.user.tenantId!
    const attendanceService = new AttendanceService()

    const [status, today] = await Promise.all([
        attendanceService.getCurrentAttendanceStatus(userId, { tenantId }),
        getTodayMetadata(userId, tenantId)
    ])

    return NextResponse.json({ success: true, data: status, today })
})
