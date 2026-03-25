import { prisma } from '@/lib/prisma'
import { HolidayRepository } from '@/modules/attendance/repositories/HolidayRepository'
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

    const holidayRepo = new HolidayRepository()
    const { isHoliday, holiday } = await holidayRepo.isHoliday(new Date(), tenantId)

    const userData = await prisma.user.findFirst({
        where: { id: userId, tenantId },
        select: { workDays: true, workingHourMode: true }
    })

    let isOffDay = false
    let isTukarLiburWorkDay = false 
    let isTukarLiburLeaveDay = false 

    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)

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

    if (userData?.workDays && userData?.workingHourMode !== 'FLEXIBLE') {
        const dayOfWeek = today.getDay() 
        const dayMap: Record<string, number> = {
            'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6,
            'Minggu': 0, 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6,
            '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6
        }
        const workDays = userData.workDays.split(',').map((d: string) => {
            const trimmed = d.trim()
            const parsed = parseInt(trimmed)
            if (!isNaN(parsed)) return parsed
            return dayMap[trimmed]
        }).filter((d) => d !== undefined)
        isOffDay = workDays.length > 0 && !workDays.includes(dayOfWeek)
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
