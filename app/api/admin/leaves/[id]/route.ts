import { NextResponse } from 'next/server'
import { LeaveRepository } from '@/modules/attendance/repositories/LeaveRepository'
import { LeaveBalanceRepository } from '@/modules/attendance/repositories/LeaveBalanceRepository'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createNotification } from '@/modules/notification/services/NotificationService'
import { hasPermission } from '@/lib/rbac'
import { LeaveType } from '@prisma/client'

const repo = new LeaveRepository()
const leaveBalanceRepo = new LeaveBalanceRepository()

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Permission check - using VERIFY for status updates (Approval/Rejection)
        if (!await hasPermission('izin:verify')) {
            return NextResponse.json({ error: 'Forbidden: You need verify permission' }, { status: 403 })
        }

        const body = await request.json()
        const { status, rejectionReason } = body

        if (!status) return NextResponse.json({ error: 'Status required' }, { status: 400 })

        // NEW: Ownership Check
        const existing = await import('@/lib/prisma').then(m => m.prisma.leaveRequest.findUnique({
            where: { id },
            include: { user: true }
        }))

        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

        const user = session.user as any;
        const isSuperAdmin = user.role === 'SUPER_ADMIN';
        if (!isSuperAdmin) {
             if (user.permissions?.includes('izin:site_only') && existing.user.siteId !== user.siteId) {
                 return NextResponse.json({ error: 'Forbidden: Restricted to your Site' }, { status: 403 })
             }
             if (user.permissions?.includes('izin:department_only') && existing.user.departmentId !== user.departmentId) {
                  return NextResponse.json({ error: 'Forbidden: Restricted to your Dept' }, { status: 403 })
             }
        }

        const result = await repo.update(id, {
            status,
            rejectionReason,
            approvedBy: status === 'APPROVED' ? session.user.id : undefined
        })

        // Update LeaveBalance when approved (skip FLEXIBLE users and TUKAR_LIBUR)
        if (status === 'APPROVED' && existing.user.workingHourMode !== 'FLEXIBLE' && existing.type !== 'TUKAR_LIBUR') {
            try {
                const leaveDays = Math.ceil(
                    (existing.endDate.getTime() - existing.startDate.getTime()) / (1000 * 60 * 60 * 24)
                ) + 1
                const year = existing.startDate.getFullYear()
                
                await leaveBalanceRepo.incrementUsed(
                    existing.userId,
                    year,
                    existing.type as LeaveType,
                    leaveDays
                )
            } catch (error) {
                console.error('Failed to update leave balance:', error)
                // Don't fail the approval just because balance update failed
            }
        }

        // System Log
        try {
            const { logger } = await import('@/lib/logger')
            await logger.logActivity({
                action: 'UPDATE', // Use STATUS_CHANGE or UPDATE? UPDATE is standard.
                subject: 'LeaveRequest',
                userId: session.user.id,
                details: { 
                    id, 
                    status, 
                    rejectionReason, 
                    userId: result.userId,
                    employeeName: existing.user.name 
                }
            })
        } catch (e) {
            console.error('Logging failed', e)
        }

        // Notify User
        try {
            const title = status === 'APPROVED' ? '✅ Izin Disetujui' : '❌ Izin Ditolak'
            const message = status === 'APPROVED'
                ? 'Pengajuan izin Anda telah disetujui.'
                : `Pengajuan izin Anda ditolak. Alasan: ${rejectionReason}`

            await createNotification({
                type: 'SYSTEM',
                priority: 'NORMAL', // Changed from HIGH to NORMAL to prevent Admin broadcast
                title,
                message,
                link: '/karyawan/izin',
                userId: result.userId,
                sourceType: 'LEAVE',
                sourceId: result.id
            })
        } catch (error) {
            console.error('Failed to notify user', error)
        }

        return NextResponse.json(result)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Permission check
        if (!await hasPermission('izin:delete')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // NEW: Ownership Check
        const existing = await import('@/lib/prisma').then(m => m.prisma.leaveRequest.findUnique({
             where: { id },
             include: { user: true }
        }))
 
        if (existing) {
             const user = session.user as any;
             const isSuperAdmin = user.role === 'SUPER_ADMIN';
             if (!isSuperAdmin) {
                  if (user.permissions?.includes('izin:site_only') && existing.user.siteId !== user.siteId) {
                      return NextResponse.json({ error: 'Forbidden: Restricted to your Site' }, { status: 403 })
                  }
                  if (user.permissions?.includes('izin:department_only') && existing.user.departmentId !== user.departmentId) {
                       return NextResponse.json({ error: 'Forbidden: Restricted to your Dept' }, { status: 403 })
                  }
             }
        }

        await repo.delete(id)

        // System Log
        try {
            const { logger } = await import('@/lib/logger')
            await logger.logActivity({
                action: 'DELETE',
                subject: 'LeaveRequest',
                userId: session.user.id,
                details: { 
                    id,
                    employeeName: existing?.user.name 
                }
            })
        } catch (e) {
            console.error('Logging failed', e)
        }

        return NextResponse.json({ message: 'Deleted successfully' })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
