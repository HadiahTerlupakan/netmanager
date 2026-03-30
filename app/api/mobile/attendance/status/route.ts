import { NextResponse } from 'next/server'

import { createHandler } from '@/lib/api'
import { prisma } from '@/lib/prisma'
import { AttendanceService } from '@/modules/attendance/services/AttendanceService'
import { HolidayRepository } from '@/modules/attendance/repositories/HolidayRepository'

type MobileTodayMetadata = {
    isHoliday: boolean
    holidayName: string | null
    isOffDay: boolean
    isTukarLiburWorkDay: boolean
    isTukarLiburLeaveDay: boolean
}

const DAY_MAP: Record<string, string[]> = {
    SUNDAY: ['SUNDAY', 'MINGGU', '0'],
    MONDAY: ['MONDAY', 'SENIN', '1'],
    TUESDAY: ['TUESDAY', 'SELASA', '2'],
    WEDNESDAY: ['WEDNESDAY', 'RABU', '3'],
    THURSDAY: ['THURSDAY', 'KAMIS', '4'],
    FRIDAY: ['FRIDAY', 'JUMAT', '5'],
    SATURDAY: ['SATURDAY', 'SABTU', '6']
}

function normalizeWorkDays(workDays: unknown): string[] {
    if (!Array.isArray(workDays)) {
        return []
    }

    return workDays.map((day) => String(day).toUpperCase())
}

async function getTodayMetadata(userId: string, tenantId: string): Promise<MobileTodayMetadata> {
    const holidayRepo = new HolidayRepository()
    const today = new Date()
    const todayStart = new Date(today)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(today)
    todayEnd.setHours(23, 59, 59, 999)

    const [holidayInfo, userData, tukarLibur] = await Promise.all([
        holidayRepo.isHoliday(today, tenantId),
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

    const todayKey = today.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
    const normalizedWorkDays = normalizeWorkDays(userData?.workDays)
    const matchingDays = DAY_MAP[todayKey] ?? [todayKey]

    let isOffDay = false
    if (userData?.workingHourMode !== 'FLEXIBLE') {
        isOffDay = !matchingDays.some((day) => normalizedWorkDays.includes(day))
    }

    const isTukarLiburWorkDay = Boolean(tukarLibur?.replacementDate)
    const isTukarLiburLeaveDay = Boolean(tukarLibur?.startDate && !tukarLibur?.replacementDate)

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
