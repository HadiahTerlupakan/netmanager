import { OvertimeRepository } from '../repositories/OvertimeRepository'
import { OvertimeStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export class OvertimeService {
    private repository: OvertimeRepository

    constructor() {
        this.repository = new OvertimeRepository()
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
        return this.repository.create({
            user: { connect: { id: userId } },
            reason: data.reason,
            status: OvertimeStatus.PENDING,
        })
    }

    // 2. Start Overtime (Wajib sudah APPROVED dan sudah CHECKOUT)
    async startOvertime(userId: string, overtimeId: string, data: { photo: string, location?: string }) {
        const overtime = await this.repository.findById(overtimeId)

        if (!overtime) throw new Error('Overtime data not found')
        if (overtime.userId !== userId) throw new Error('Unauthorized')

        if (overtime.status !== OvertimeStatus.APPROVED) {
            throw new Error('Pengajuan lembur belum disetujui atau status tidak valid.')
        }

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
            }
        })

        if (!attendance) {
            throw new Error('Anda harus melakukan Checkout absen reguler terlebih dahulu sebelum memulai lembur.')
        }

        return this.repository.update(overtimeId, {
            status: OvertimeStatus.IN_PROGRESS,
            startTime: new Date(),
            startPhoto: data.photo,
            startLocation: data.location,
            attendance: { connect: { id: attendance.id } } // Link to attendance saat start
        })
    }

    // 3. Stop Overtime
    async stopOvertime(userId: string, overtimeId: string, data: { photo: string, location?: string }) {
        const overtime = await this.repository.findById(overtimeId)

        if (!overtime) throw new Error('Overtime data not found')
        if (overtime.userId !== userId) throw new Error('Unauthorized')

        if (overtime.status !== OvertimeStatus.IN_PROGRESS) {
            throw new Error('Lembur belum dimulai.')
        }

        if (!overtime.startTime) {
            throw new Error('Data Start Time corrupt.')
        }

        const endTime = new Date()
        const durationMs = endTime.getTime() - new Date(overtime.startTime).getTime()
        const durationMinutes = Math.round(durationMs / 60000)

        return this.repository.update(overtimeId, {
            status: OvertimeStatus.COMPLETED,
            endTime: endTime,
            endPhoto: data.photo,
            endLocation: data.location,
            duration: durationMinutes
        })
    }

    async getHistory(userId: string) {
        return this.repository.findAll({ userId })
    }

    async getAllRequests(filters?: { status?: OvertimeStatus }) {
        return this.repository.findAll(filters)
    }

    async approveRequest(id: string, approverId: string) {
        return this.repository.update(id, {
            status: OvertimeStatus.APPROVED,
            approvedBy: approverId
        })
    }

    async rejectRequest(id: string, reason: string) {
        return this.repository.update(id, {
            status: OvertimeStatus.REJECTED,
            rejectionReason: reason
        })
    }

    async deleteOvertime(id: string) {
        return this.repository.delete(id)
    }
}
