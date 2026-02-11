import { NextResponse } from 'next/server'
import { LeaveRepository } from '@/modules/attendance/repositories/LeaveRepository'
import { LeaveBalanceRepository } from '@/modules/attendance/repositories/LeaveBalanceRepository'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { LeaveType, LeaveStatus, Prisma } from '@prisma/client'
import { createNotification } from '@/modules/notification/services/NotificationService'
import { prisma } from '@/lib/prisma'
import { convertAndSaveBase64 } from '@/lib/utils/image-upload'

const repo = new LeaveRepository()
const leaveBalanceRepo = new LeaveBalanceRepository()

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')

        if (!token) {
            return NextResponse.json({ error: 'Token wajib diisi' }, { status: 401 })
        }

        const user = await verifyMobileToken(token) as unknown as { id: string };
        if (!user) {
            return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
        }

        const leaves = await repo.findAll({ userId: user.id })
        return NextResponse.json({ success: true, data: leaves })
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan';
        return NextResponse.json({ error: errorMessage }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')

        if (!token) {
            return NextResponse.json({ error: 'Token wajib diisi' }, { status: 401 })
        }

        const user = await verifyMobileToken(token) as unknown as { id: string };
        if (!user) {
            return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
        }

        const body = await request.json()
        const { type, startDate, endDate, reason, photos, replacementDate } = body

        if (!type || !startDate || !endDate || !reason) {
            return NextResponse.json({ error: 'Field wajib tidak lengkap' }, { status: 400 })
        }

        // Calculate leave days
        const start = new Date(startDate)
        const end = new Date(endDate)
        const leaveDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
        const currentYear = start.getFullYear()

        // Check user's working hour mode - FLEXIBLE users don't have leave quotas
        const userData = await prisma.user.findUnique({
            where: { id: user.id },
            select: { workingHourMode: true, workDays: true, name: true }
        })

        // Validate leave quota (skip for FLEXIBLE users and TUKAR_LIBUR type)
        if (userData?.workingHourMode !== 'FLEXIBLE' && type !== 'TUKAR_LIBUR') {
            const hasEnough = await leaveBalanceRepo.hasEnoughDays(user.id, currentYear, type as LeaveType, leaveDays)
            if (!hasEnough) {
                const remaining = await leaveBalanceRepo.getRemainingDays(user.id, currentYear, type as LeaveType)
                return NextResponse.json({ 
                    error: `Kuota ${type} tidak cukup. Sisa: ${remaining} hari, Dibutuhkan: ${leaveDays} hari.`
                }, { status: 400 })
            }
        }

        // Validate attachment for non-CUTI types
        if (type !== 'CUTI' && type !== 'TUKAR_LIBUR' && (!photos || photos.length === 0)) {
            return NextResponse.json({ error: 'Foto bukti wajib diupload' }, { status: 400 })
        }

        // Validate replacementDate for TUKAR_LIBUR
        if (type === 'TUKAR_LIBUR') {
            if (!replacementDate) {
                return NextResponse.json({ error: 'Tanggal pengganti wajib diisi untuk Tukar Libur' }, { status: 400 })
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
                const holiday = formattedReplacementDate ? await prisma.holiday.findUnique({
                    where: { date: new Date(formattedReplacementDate) }
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
                const fileName = `leave_${user.id}_${timestamp}_${i}`
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
            user: { connect: { id: user.id } },
            type: type as LeaveType,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            replacementDate: replacementDate ? new Date(replacementDate) : null,
            reason,
            attachments: attachments,
            status: LeaveStatus.PENDING
        }

        if (attachments.length > 0) {
            createData.attachmentUrl = attachments[0]
        }

        const requestData = await repo.create(createData as unknown as Prisma.LeaveRequestCreateInput)

        // Notify Admins
        try {
            const userData = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } })
            const admins = await prisma.user.findMany({
                where: {
                    isActive: true, // Only notify active admins
                    OR: [
                        { role: { name: { in: ['SUPER_ADMIN', 'Super Admin'] } } },
                        {
                            role: {
                                permission: {
                                    some: {
                                        resource: { in: ['attendance', 'kehadiran'] },
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
                    title: '📋 Pengajuan Izin Baru (Mobile)',
                    message: `${userData?.name} mengajukan ${type}: ${reason}`,
                    link: '/admin/kehadiran/izin',
                    userId: admin.id,
                    sourceType: 'LEAVE',
                    sourceId: requestData.id
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
