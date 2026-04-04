import { prisma } from '@/lib/prisma'
import { HolidayRepository, AttendanceTimezoneService } from '@/modules/attendance'
import { isOffDayForUser } from '@/modules/attendance/utils/workingDayUtils'
import { apiPaginated, createHandler } from '@/lib/api'

export const dynamic = 'force-dynamic'

const STALE_FLEXIBLE_SESSION_HOURS = 24

export const GET = createHandler({ auth: true }, async (_request, ctx) => {
    const userSession = ctx.session!.user
    const userId = userSession.id
    const tenantId = userSession.tenantId as string

    const page = parseInt(ctx.query.page as string || '1')
    const limit = parseInt(ctx.query.limit as string || '10')
    const skip = (page - 1) * limit

    const [attendances, total] = await Promise.all([
        prisma.attendance.findMany({
            where: { userId, tenantId },
            orderBy: { checkIn: 'desc' },
            take: limit,
            skip,
            include: {
                user: {
                    select: {
                        workingHourMode: true,
                        flexibleTargetHour: true,
                        shift: {
                            select: {
                                startTime: true,
                                endTime: true
                            }
                        }
                    }
                }
            }
        }),
        prisma.attendance.count({ where: { userId, tenantId } })
    ])

    const now = new Date()
    const attendancesWithSessionMeta = attendances.map((attendance) => {
        const isStaleFlexibleSession =
            attendance.user?.workingHourMode === 'FLEXIBLE'
            && attendance.checkOut === null
            && (now.getTime() - attendance.checkIn.getTime()) > STALE_FLEXIBLE_SESSION_HOURS * 60 * 60 * 1000

        return {
            ...attendance,
            sessionMeta: {
                isStaleFlexibleSession
            }
        }
    })

    // Use tenant timezone for accurate day-of-week calculation
    const timezoneService = new AttendanceTimezoneService()
    const tz = await timezoneService.getTimezone(tenantId)
    const { now: todayInTz, startOfDay: todayStart } = timezoneService.getEffectiveDate(tz)
    const todayEnd = new Date(todayStart)
    todayEnd.setHours(23, 59, 59, 999)

    const holidayRepo = new HolidayRepository()
    const { isHoliday, holiday } = await holidayRepo.isHoliday(todayStart, tenantId)

    const userData = await prisma.user.findFirst({
        where: { id: userId, tenantId },
        select: { workDays: true, workingHourMode: true }
    })

    const dayOfWeek = todayInTz.getDay()
    let isOffDay = isOffDayForUser(dayOfWeek, userData?.workDays ?? null, userData?.workingHourMode ?? null)

    let isTukarLiburWorkDay = false
    let isTukarLiburLeaveDay = false

    const approvedTukarLibur = await prisma.leaveRequest.findFirst({
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

    if (approvedTukarLibur) {
        const startDateMatch = approvedTukarLibur.startDate && approvedTukarLibur.startDate >= todayStart && approvedTukarLibur.startDate <= todayEnd
        const replacementDateMatch = approvedTukarLibur.replacementDate && approvedTukarLibur.replacementDate >= todayStart && approvedTukarLibur.replacementDate <= todayEnd

        if (replacementDateMatch) isTukarLiburWorkDay = true
        if (startDateMatch) isTukarLiburLeaveDay = true
    }

    if (isTukarLiburWorkDay) isOffDay = false
    if (isTukarLiburLeaveDay) isOffDay = true

    return apiPaginated(attendancesWithSessionMeta, {
        page,
        limit,
        total,
        today: {
            isHoliday,
            holidayName: holiday?.description || null,
            isOffDay,
            isTukarLiburWorkDay,
            isTukarLiburLeaveDay
        }
    } as unknown as Parameters<typeof apiPaginated>[1])
})
