import { OvertimeRepository } from '../repositories/OvertimeRepository'
import { OvertimeStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createNotification } from '../../notification/services/NotificationService'
import { HolidayRepository } from '../../attendance/repositories/HolidayRepository'

export class OvertimeService {
    private repository: OvertimeRepository
    private holidayRepository: HolidayRepository

    constructor() {
        this.repository = new OvertimeRepository()
        this.holidayRepository = new HolidayRepository()
    }

    // 1. Create Request - Bisa kapan saja selama hari itu (tidak perlu absen dulu)
    async createRequest(
        userId: string,
        data: {
            date: Date
            reason: string
        }
    ) {
        const startOfDay = new Date(data.date)
        startOfDay.setHours(0, 0, 0, 0)

        const endOfDay = new Date(data.date)
        endOfDay.setHours(23, 59, 59, 999)

        // Cek apakah sudah ada request PENDING/APPROVED/IN_PROGRESS hari ini
        const existing = await prisma.overtime.findFirst({
            where: {
                userId: userId,
                createdAt: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
                status: {
                    in: [OvertimeStatus.PENDING, OvertimeStatus.APPROVED, OvertimeStatus.IN_PROGRESS]
                }
            }
        })

        if (existing) {
            throw new Error('Anda sudah memiliki pengajuan lembur aktif untuk hari ini.')
        }

        // Buat request tanpa attendance link (akan di-link saat start)
        const request = await this.repository.create({
            user: { connect: { id: userId } },
            reason: data.reason,
            status: OvertimeStatus.PENDING,
        })

        // Notify Admins
        try {
            const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } })
            const admins = await prisma.user.findMany({
                where: {
                    OR: [
                        { role: { name: 'SUPER_ADMIN' } },
                        {
                            role: {
                                permission: {
                                    some: {
                                        resource: 'lembur',
                                        action: 'update'
                                    }
                                }
                            }
                        }
                    ]
                },
                select: { id: true }
            })

            for (const admin of admins) {
                await createNotification({
                    type: 'SYSTEM',
                    priority: 'NORMAL',
                    title: '🔔 Pengajuan Lembur Baru',
                    message: `${user?.name || 'Karyawan'} mengajukan lembur: ${data.reason}`,
                    link: '/admin/lembur',
                    userId: admin.id,
                    sourceType: 'OVERTIME',
                    sourceId: request.id
                })
            }
        } catch (error) {
            console.error('Failed to send notification:', error)
        }

        return request
    }
    async startOvertime(userId: string, overtimeId: string, data: { photo: string, location?: string, timestamp?: Date }) {
        const overtime = await this.repository.findById(overtimeId)

        if (!overtime) throw new Error('Overtime data not found')
        if (overtime.userId !== userId) throw new Error('Unauthorized')

        if (overtime.status !== OvertimeStatus.APPROVED) {
            throw new Error('Pengajuan lembur belum disetujui atau status tidak valid.')
        }

        // Cek apakah hari ini libur
        const today = new Date()
        const { isHoliday } = await this.holidayRepository.isHoliday(today)

        // Cari attendance hari ini yang sudah checkout
        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date()
        endOfDay.setHours(23, 59, 59, 999)

        const attendance = await prisma.attendance.findFirst({
            where: {
                userId: userId,
                checkIn: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
                checkOut: { not: null } // Wajib sudah checkout
            },
            orderBy: {
                checkIn: 'desc'
            },
            include: {
                user: {
                    select: {
                        workingHourMode: true,
                        flexibleTargetHour: true
                    }
                }
            }
        })

        // VALIDASI:
        // Jika BUKAN hari libur, dan TIDAK ADA attendance yg checkout -> error
        if (!isHoliday && !attendance) {
            throw new Error('Anda harus melakukan Checkout absen reguler terlebih dahulu sebelum memulai lembur.')
        }

        // Check whether it is a holiday or not
        if (attendance && attendance.user.workingHourMode === 'FLEXIBLE' && !isHoliday) {
            const checkInTime = new Date(attendance.checkIn).getTime()
            const checkOutTime = new Date(attendance.checkOut!).getTime() // Pasti ada krn query filter
            const durationHours = (checkOutTime - checkInTime) / (1000 * 60 * 60)
            
            // Default target 8 jam jika null
            const targetHours = attendance.user.flexibleTargetHour || 8

            if (durationHours < targetHours) {
                const shortfall = (targetHours - durationHours).toFixed(1)
                throw new Error(`Total jam kerja Anda (${durationHours.toFixed(1)} jam) belum memenuhi target harian (${targetHours} jam). Kurang: ${shortfall} jam. Tidak dapat memulai lembur.`)
            }
        }

        return this.repository.update(overtimeId, {
            status: OvertimeStatus.IN_PROGRESS,
            startTime: data.timestamp || new Date(),
            startPhoto: data.photo,
            startLocation: data.location,
            // Connect attendance hanya jika ada (hari kerja biasa)
            attendance: attendance ? { connect: { id: attendance.id } } : undefined
        })
    }

    // 3. Stop Overtime
    async stopOvertime(userId: string, overtimeId: string, data: { photo: string, location?: string, timestamp?: Date }) {
        const overtime = await this.repository.findById(overtimeId)

        if (!overtime) throw new Error('Overtime data not found')
        if (overtime.userId !== userId) throw new Error('Unauthorized')

        if (overtime.status !== OvertimeStatus.IN_PROGRESS) {
            throw new Error('Lembur belum dimulai.')
        }

        if (!overtime.startTime) {
            throw new Error('Data Start Time corrupt.')
        }

        const endTime = data.timestamp || new Date()
        const durationMs = endTime.getTime() - new Date(overtime.startTime).getTime()
        const durationMinutes = Math.round(durationMs / 60000)

        // Prevent negative duration if clocks are messed up
        const validDuration = durationMinutes > 0 ? durationMinutes : 0

        return this.repository.update(overtimeId, {
            status: OvertimeStatus.COMPLETED,
            endTime: endTime,
            endPhoto: data.photo,
            endLocation: data.location,
            duration: validDuration
        })
    }

    async getHistory(userId: string) {
        return this.repository.findAll({ userId })
    }

    async getAllRequests(filters?: {
        status?: OvertimeStatus
        startDate?: Date
        endDate?: Date
        siteId?: string
        departmentId?: string
        skip?: number
        take?: number
    }) {
        const [data, total, summary] = await Promise.all([
            this.repository.findAll(filters),
            this.repository.count(filters),
            this.repository.countByStatus(filters)
        ])
        return { data, total, summary }
    }

    async approveRequest(id: string, approverId: string) {
        const result = await this.repository.update(id, {
            status: OvertimeStatus.APPROVED,
            approvedBy: approverId
        })

        // Notify User
        try {
            await createNotification({
                type: 'SYSTEM',
                priority: 'HIGH',
                title: '✅ Pengajuan Lembur Disetujui',
                message: 'Pengajuan lembur Anda telah disetujui. Silakan mulai lembur setelah checkout.',
                link: '/karyawan/lembur',
                userId: result.userId,
                sourceType: 'OVERTIME',
                sourceId: result.id
            })
        } catch (error) {
            console.error('Failed to send notification:', error)
        }

        return result
    }

    async rejectRequest(id: string, reason: string) {
        const result = await this.repository.update(id, {
            status: OvertimeStatus.REJECTED,
            rejectionReason: reason
        })

        // Notify User
        try {
            await createNotification({
                type: 'SYSTEM',
                priority: 'HIGH',
                title: '❌ Pengajuan Lembur Ditolak',
                message: `Alasan: ${reason}`,
                link: '/karyawan/lembur',
                userId: result.userId,
                sourceType: 'OVERTIME',
                sourceId: result.id
            })
        } catch (error) {
            console.error('Failed to send notification:', error)
        }

        return result
    }

    async deleteOvertime(id: string) {
        return this.repository.delete(id)
    }

    async getReportData(startDate: Date, endDate: Date, siteId?: string, departmentId?: string) {
        const [stats, dailyStats, groupedBySite, groupedByDept, topEmployees] = await Promise.all([
            this.repository.getStatsByDateRange(startDate, endDate, siteId, departmentId),
            this.repository.getDailyStats(startDate, endDate, siteId, departmentId),
            this.repository.getGroupedStats(startDate, endDate, 'site'),
            this.repository.getGroupedStats(startDate, endDate, 'department'),
            this.repository.getTopEmployees(startDate, endDate, 5, siteId, departmentId)
        ])

        return {
            summary: {
                totalRequests: stats.totalRequests,
                totalDuration: stats.totalDuration,
                avgDuration: stats.totalRequests > 0 ? Math.round(stats.totalDuration / stats.totalRequests) : 0
            },
            trends: dailyStats,
            bySite: groupedBySite,
            byDepartment: groupedByDept,
            topEmployees
        }
    }
}
