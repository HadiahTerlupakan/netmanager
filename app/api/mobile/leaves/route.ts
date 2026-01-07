import { NextResponse } from 'next/server'
import { LeaveRepository } from '@/modules/attendance/repositories/LeaveRepository'
import { verifyMobileToken } from '@/lib/mobile-auth'
import { LeaveType, LeaveStatus } from '@prisma/client'
import { createNotification } from '@/modules/notification/services/NotificationService'
import { prisma } from '@/lib/prisma'
import { convertAndSaveBase64 } from '@/lib/utils/image-upload'

const repo = new LeaveRepository()

export async function GET(request: Request) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')

        if (!token) {
            return NextResponse.json({ error: 'Token required' }, { status: 401 })
        }

        const user = await verifyMobileToken(token) as { id: string } | null
        if (!user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        const leaves = await repo.findAll({ userId: user.id })
        return NextResponse.json({ success: true, data: leaves })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('authorization')
        const token = authHeader?.replace('Bearer ', '')

        if (!token) {
            return NextResponse.json({ error: 'Token required' }, { status: 401 })
        }

        const user = await verifyMobileToken(token) as { id: string } | null
        if (!user) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        const body = await request.json()
        const { type, startDate, endDate, reason, photos, replacementDate } = body

        if (!type || !startDate || !endDate || !reason) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Validate attachment for non-CUTI types
        if (type !== 'CUTI' && type !== 'TUKAR_LIBUR' && (!photos || photos.length === 0)) {
            return NextResponse.json({ error: 'Foto bukti wajib diupload' }, { status: 400 })
        }

        // Validate replacementDate for TUKAR_LIBUR
        if (type === 'TUKAR_LIBUR' && !replacementDate) {
            return NextResponse.json({ error: 'Tanggal pengganti wajib diisi untuk Tukar Libur' }, { status: 400 })
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

        const requestData = await repo.create({
            user: { connect: { id: user.id } },
            type: type as LeaveType,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            replacementDate: replacementDate ? new Date(replacementDate) : null,
            reason,
            attachmentUrl: attachments.length > 0 ? attachments[0] : null,
            attachments: attachments,
            status: LeaveStatus.PENDING
        })

        // Notify Admins
        try {
            const userData = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } })
            const admins = await prisma.user.findMany({
                where: {
                    isActive: true, // Only notify active admins
                    OR: [
                        { role: { name: 'SUPER_ADMIN' } },
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
    } catch (error: any) {
        console.error('Leave request error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
