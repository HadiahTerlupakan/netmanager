import { NextResponse } from 'next/server'
import { LeaveRepository } from '@/modules/attendance/repositories/LeaveRepository'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LeaveType, LeaveStatus } from '@prisma/client'
import { createNotification } from '@/modules/notification/services/NotificationService'
import { prisma } from '@/lib/prisma'

const repo = new LeaveRepository()

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const leaves = await repo.findAll({ userId: session.user.id })
        return NextResponse.json(leaves)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await request.json()
        const { type, startDate, endDate, reason, attachmentUrl, attachments } = body

        if (!type || !startDate || !endDate || !reason) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Handle backward compatibility or simplified frontend
        const finalAttachments = attachments || (attachmentUrl ? [attachmentUrl] : [])
        const finalAttachmentUrl = attachmentUrl || (finalAttachments.length > 0 ? finalAttachments[0] : null)

        const requestData = await repo.create({
            user: { connect: { id: session.user.id } },
            type: type as LeaveType,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            reason,
            attachmentUrl: finalAttachmentUrl,
            attachments: finalAttachments,
            status: LeaveStatus.PENDING
        })

        // Notify Admins
        try {
            const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } })
            const admins = await prisma.user.findMany({
                where: {
                    OR: [
                        { role: { name: 'SUPER_ADMIN' } },
                        {
                            role: {
                                permissions: {
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
                    title: '📋 Pengajuan Izin Baru',
                    message: `${user?.name} mengajukan ${type}: ${reason}`,
                    link: '/admin/kehadiran/izin',
                    userId: admin.id,
                    sourceType: 'LEAVE',
                    sourceId: requestData.id
                })
            }
        } catch (error) {
            console.error('Failed to notify admins', error)
        }

        return NextResponse.json(requestData, { status: 201 })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
