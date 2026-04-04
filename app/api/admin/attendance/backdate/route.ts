import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createHandler } from '@/lib/api'
import { isSuperAdmin } from '@/lib/auth'
import { ApiErrors } from '@/lib/api-response'
import { toStartOfDay, toEndOfDay } from '@/lib/utils/server-datetime'
import { getTimezone } from '@/lib/utils/get-timezone'
import * as z from 'zod'
import { randomUUID } from 'crypto'

const backdateSchema = z.object({
    startDate: z.string(),
    endDate: z.string(),
})

export const POST = createHandler({ auth: true }, async (req, ctx) => {
    const user = ctx.session!.user
    const tenantId = user.tenantId

    if (!tenantId) {
        return ApiErrors.badRequest('Tenant ID tidak ditemukan')
    }

    if (!isSuperAdmin(user)) {
        return ApiErrors.forbidden('Hanya Superadmin yang dapat melakukan backfill absensi')
    }

    const body = await req.json()
    const parseResult = backdateSchema.safeParse(body)

    if (!parseResult.success) {
        return ApiErrors.badRequest('Data tidak valid', { errors: parseResult.error.flatten().fieldErrors })
    }

    const { startDate: startDateStr, endDate: endDateStr } = parseResult.data

    try {
        const timezone = await getTimezone(tenantId)
        
        const start = new Date(toStartOfDay(startDateStr, timezone))
        let end = new Date(toEndOfDay(endDateStr, timezone))
        
        const now = new Date()
        if (end > now) {
            end = now
        }

        if (start > end) {
             return ApiErrors.badRequest('Tanggal awal tidak bisa lebih dari tanggal akhir')
        }

        let totalGenerated = 0

        // Get all active users requiring attendance
        const users = await prisma.user.findMany({
            where: {
                tenantId: tenantId,
                isActive: true,
                isAttendanceRequired: true
            },
            select: {
                id: true,
                workDays: true
            }
        })

        const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const dateFormatter = new Intl.DateTimeFormat('en-CA', { 
            timeZone: timezone, 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit' 
        })

        // Iterate day by day
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const currentDayDateStr = dateFormatter.format(d)
            const dayStart = toStartOfDay(currentDayDateStr, timezone)
            const dayEnd = toEndOfDay(currentDayDateStr, timezone)
            const dayName = dayMap[d.getDay()]
            const dayNum = d.getDay().toString()

            // Check holiday
            const holiday = await prisma.holiday.findFirst({
                where: {
                    tenantId: tenantId,
                    date: {
                        gte: dayStart,
                        lte: dayEnd
                    }
                }
            })

            if (holiday) continue

            for (const user of users) {
                const workDays = user.workDays?.split(',').map(d => d.trim()) || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
                if (!workDays.includes(dayName) && !workDays.includes(dayNum)) {
                    continue // Not a work day
                }

                const existingAttendance = await prisma.attendance.findFirst({
                    where: {
                        userId: user.id,
                        tenantId: tenantId,
                        checkIn: {
                            gte: dayStart,
                            lte: dayEnd
                        }
                    }
                })

                if (!existingAttendance) {
                    const dummyCheckIn = new Date(dayStart)
                    await prisma.attendance.create({
                        data: {
                            id: randomUUID(),
                            userId: user.id,
                            tenantId: tenantId,
                            checkIn: dummyCheckIn,
                            status: 'ABSENT',
                            notes: 'Tanpa Keterangan',
                            location: 'System (Backdate)',
                            updatedAt: new Date()
                        }
                    })
                    totalGenerated++
                }
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                message: `Berhasil backfill! ${totalGenerated} data absensi (ABSENT) telah ditambahkan.`,
                generatedCount: totalGenerated
            }
        })
    } catch (error) {
        console.error('Attendance Backdate Error:', error)
        return ApiErrors.internalError('Gagal melakukan backfill absensi')
    }
})
