import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMobileAuthPayload } from '@/lib/mobile-api-auth'
import { HolidayRepository } from '@/modules/attendance/repositories/HolidayRepository'

export const dynamic = 'force-dynamic'

const STALE_FLEXIBLE_SESSION_HOURS = 24

export async function GET(request: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const payload = authResult
        const userId = payload.id as string

        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')
        const skip = (page - 1) * limit

        const [attendances, total] = await Promise.all([
            prisma.attendance.findMany({
                where: { userId },
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
            prisma.attendance.count({ where: { userId } })
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

        // Check Holiday for Today (User Filter? Timezone?)
        // Ideally we should use user's timezone, but for now server time or basic check is okay for display.
        // We will assume server time ~ user time for simplicity or refine later.
        const holidayRepo = new HolidayRepository()
        const { isHoliday, holiday } = await holidayRepo.isHoliday(new Date())

        // Check Off Day for Today (based on user's workDays)
        const userData = await prisma.user.findUnique({
            where: { id: userId },
            select: { workDays: true, workingHourMode: true }
        })

        let isOffDay = false
        let isTukarLiburWorkDay = false // True jika hari ini adalah replacementDate dari TUKAR_LIBUR yang approved
        let isTukarLiburLeaveDay = false // True jika hari ini adalah startDate dari TUKAR_LIBUR yang approved

        // Check approved TUKAR_LIBUR for today
        const today = new Date()
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
        const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)

        const approvedTukarLibur = await prisma.leaveRequest.findFirst({
            where: {
                userId,
                type: 'TUKAR_LIBUR',
                status: 'APPROVED',
                OR: [
                    // Hari ini adalah startDate (user ambil libur)
                    {
                        startDate: {
                            gte: todayStart,
                            lte: todayEnd
                        }
                    },
                    // Hari ini adalah replacementDate (user masuk ganti)
                    {
                        replacementDate: {
                            gte: todayStart,
                            lte: todayEnd
                        }
                    }
                ]
            }
        })

        if (approvedTukarLibur) {
            const startDateMatch = approvedTukarLibur.startDate &&
                approvedTukarLibur.startDate >= todayStart &&
                approvedTukarLibur.startDate <= todayEnd
            const replacementDateMatch = approvedTukarLibur.replacementDate &&
                approvedTukarLibur.replacementDate >= todayStart &&
                approvedTukarLibur.replacementDate <= todayEnd

            if (replacementDateMatch) {
                // Hari ini adalah replacementDate → User HARUS bisa absen (override isOffDay)
                isTukarLiburWorkDay = true
            }
            if (startDateMatch) {
                // Hari ini adalah startDate TUKAR_LIBUR → User TIDAK boleh absen
                isTukarLiburLeaveDay = true
            }
        }

        // User FLEXIBLE tidak terpengaruh workDays - bisa absen setiap hari
        if (userData?.workDays && userData?.workingHourMode !== 'FLEXIBLE') {
            const dayOfWeek = today.getDay() // 0 = Sunday, 6 = Saturday
            const dayMap: Record<string, number> = {
                'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6,
                'Minggu': 0, 'Senin': 1, 'Selasa': 2, 'Rabu': 3, 'Kamis': 4, 'Jumat': 5, 'Sabtu': 6,
                '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6
            }
            const workDays = userData.workDays.split(',').map(d => {
                const trimmed = d.trim()
                const parsed = parseInt(trimmed)
                if (!isNaN(parsed)) return parsed
                return dayMap[trimmed]
            }).filter(d => d !== undefined)
            // SAFEGUARD: Jika workDays kosong setelah parsing, jangan set isOffDay = true
            isOffDay = workDays.length > 0 && !workDays.includes(dayOfWeek)
        }

        // TUKAR_LIBUR Override Logic:
        // - Jika isTukarLiburWorkDay → Force isOffDay = false (user bisa absen)
        // - Jika isTukarLiburLeaveDay → Force isOffDay = true (user tidak boleh absen)
        if (isTukarLiburWorkDay) {
            isOffDay = false // Override: User masuk ganti hari libur
        }
        if (isTukarLiburLeaveDay) {
            isOffDay = true // Override: User ambil libur ganti hari kerja
        }


        return NextResponse.json({
            success: true,
            data: attendancesWithSessionMeta,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
            today: {
                isHoliday,
                holidayName: holiday?.description || null,
                isOffDay,
                // Info tambahan untuk Tukar Libur
                isTukarLiburWorkDay, // Hari ini user masuk ganti libur
                isTukarLiburLeaveDay // Hari ini user libur ganti hari kerja
            }
        })

    } catch (_error: unknown) {
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 })
    }
}
