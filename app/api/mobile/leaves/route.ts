import { NextRequest, NextResponse } from 'next/server'
import { LeaveRepository } from '@/modules/attendance/repositories/LeaveRepository'
import { LeaveBalanceRepository } from '@/modules/attendance/repositories/LeaveBalanceRepository'
import { getMobileAuthPayload } from '@/lib/mobile-api-auth'
import { LeaveType, LeaveStatus, Prisma } from '@prisma/client'
import { createNotification } from '@/modules/notification/services/NotificationService'
import { prisma } from '@/lib/prisma'
import { convertAndSaveBase64 } from '@/lib/utils/image-upload'
import { calculateWorkingDays } from '@/modules/attendance/utils/calculateWorkingDays'
import { apiError, ErrorCodes } from '@/lib/api-response'

const repo = new LeaveRepository()
const leaveBalanceRepo = new LeaveBalanceRepository()

export async function GET(request: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const payload = authResult
        const userId = payload.id as string
        const tenantId = payload.tenantId as string

        const leaves = await repo.findAll({ userId, tenantId })
        return NextResponse.json({ success: true, data: leaves })
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan';
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(request)
        if (authResult instanceof NextResponse) {
            return authResult
        }

        const payload = authResult
        const tenantId = payload.tenantId as string
        const userId = payload.id as string

        if (!userId) {
            return apiError('Token tidak valid', ErrorCodes.UNAUTHORIZED, { status: 401 })
        }

        const body = await request.json()
        const { type, startDate, endDate, reason, photos, replacementDate } = body

        if (!type || !startDate || !endDate || !reason) {
            return apiError('Field wajib tidak lengkap', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        const start = new Date(startDate)
        const end = new Date(endDate)
        const currentYear = start.getFullYear()

        // Check user's working hour mode - FLEXIBLE users don't have leave quotas
        const userData = await prisma.user.findFirst({
            where: { id: userId, tenantId },
            select: { workingHourMode: true, workDays: true, name: true, siteId: true }
        })

        const leaveDays = await calculateWorkingDays(start, end, userData?.workDays || null)

        // Validate leave quota (skip for FLEXIBLE users and TUKAR_LIBUR type)
        if (userData?.workingHourMode !== 'FLEXIBLE' && type !== 'TUKAR_LIBUR') {
            const hasEnough = await leaveBalanceRepo.hasEnoughDays(userId, currentYear, type as LeaveType, leaveDays, tenantId)
            if (!hasEnough) {
                const remaining = await leaveBalanceRepo.getRemainingDays(userId, currentYear, type as LeaveType, tenantId)
                return NextResponse.json({ 
                    error: `Kuota ${type} tidak cukup. Sisa: ${remaining} hari, Dibutuhkan: ${leaveDays} hari.`
                }, { status: 400 })
            }
        }

        // Validate attachment for non-CUTI types
        if (type !== 'CUTI' && type !== 'TUKAR_LIBUR' && (!photos || photos.length === 0)) {
            return apiError('Foto bukti wajib diupload', ErrorCodes.VALIDATION_ERROR, { status: 400 })
        }

        // Validate replacementDate for TUKAR_LIBUR
        if (type === 'TUKAR_LIBUR') {
            if (!replacementDate) {
                return apiError('Tanggal pengganti wajib diisi untuk Tukar Libur', ErrorCodes.VALIDATION_ERROR, { status: 400 })
            }

            if (userData?.workDays) {
                const workDays = userData.workDays.split(',').map(d => d.trim());
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                
                const start = new Date(startDate);
                const replacement = new Date(replacementDate);

                const startDayName = days[start.getDay()];
                const replacementDayName = days[replacement.getDay()];

                // Helper to format date for comparison YYYY-MM-DD
                const formatDate = (date: Date) => date.toISOString().split('T')[0];

                // 1. Validate Start Date (Must be a Work Day)
                if (!startDayName || !workDays.includes(startDayName)) {
                     return NextResponse.json({
                        error: `Tanggal izin (${startDate}) harus merupakan Hari Kerja.`
                    }, { status: 400 })
                }

                // 2. Validate Replacement Date (Must be Off Day OR Holiday)
                // Check if it's an Off Day
                const isOffDay = replacementDayName ? !workDays.includes(replacementDayName) : false;

                // Check if it's a Holiday
                const formattedReplacementDate = formatDate(replacement);
                const holiday = formattedReplacementDate ? await prisma.holiday.findFirst({
                    where: {
                        date: new Date(formattedReplacementDate),
                        tenantId
                    }
                }) : null;

                if (!isOffDay && !holiday) {
                     return NextResponse.json({ 
                        error: `Tanggal pengganti (${replacementDate}) harus merupakan Hari Libur atau Tanggal Merah.` 
                    }, { status: 400 })
                }
            }
        }

        // Convert base64 photos to URLs
        const attachments: string[] = []
        if (photos && photos.length > 0) {
            for (let i = 0; i < photos.length; i++) {
                const photo = photos[i]
                
                // If it's already a URL (from SyncService upload), just use it
                if (photo.startsWith('http') || photo.startsWith('/uploads')) {
                    attachments.push(photo);
                    continue;
                }
                
                // Otherwise treat as Base64
                const timestamp = Date.now()
                const fileName = `leave_${userId}_${timestamp}_${i}`
                const uploadDir = 'public/uploads/employee-leave'
                const url = await convertAndSaveBase64(
                    photo,
                    uploadDir,
                    fileName,
                    'employee-leave'  // uploadType for R2
                )
                if (url) attachments.push(url)
            }
        }

        const createData: Record<string, unknown> = {
            user: { connect: { id: userId } },
            type: type as LeaveType,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            replacementDate: replacementDate ? new Date(replacementDate) : null,
            reason,
            attachments: attachments,
            status: LeaveStatus.PENDING,
            tenantId
        }

        if (attachments.length > 0) {
            createData.attachmentUrl = attachments[0]
        }

        const requestData = await repo.create(createData as unknown as Prisma.LeaveRequestCreateInput)

        // Notify Admins
        try {
            const admins = await prisma.user.findMany({
                where: {
                    isActive: true, // Only notify active admins
                    tenantId,
                    OR: [
                        { role: { name: { in: ['SUPER_ADMIN', 'Super Admin'] } } },
                        {
                            AND: [
                                {
                                    role: {
                                        permission: {
                                            some: {
                                                resource: { in: ['attendance', 'kehadiran'] },
                                                action: 'update'
                                            }
                                        }
                                    }
                                },
                                ...(userData?.siteId ? [{
                                    OR: [
                                        { siteId: userData.siteId },
                                        { siteId: null },
                                        { userSites: { some: { siteId: userData.siteId } } }
                                    ]
                                }] : [])
                            ]
                        }
                    ]
                },
                select: { id: true }
            })

            for (const admin of admins) {
                await createNotification({
                    type: 'SYSTEM',
                    priority: 'NORMAL',
                    title: '📋 Pengajuan Izin Baru (Mobile)',
                    message: `${userData?.name} mengajukan ${type}: ${reason}`,
                    link: '/admin/kehadiran/izin',
                    userId: admin.id,
                    sourceType: 'LEAVE',
                    sourceId: requestData.id,
                    tenantId
                })
            }
        } catch (error) {
            console.error('Failed to notify admins', error)
        }

        return NextResponse.json({ success: true, data: requestData }, { status: 201 })
    } catch (error: unknown) {
        console.error('Leave request error:', error)
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Terjadi kesalahan' }, { status: 500 })
    }
}
