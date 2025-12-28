import { NextResponse } from 'next/server'
import { LeaveRepository } from '@/modules/attendance/repositories/LeaveRepository'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createNotification } from '@/modules/notification/services/NotificationService'
import { hasPermission } from '@/lib/rbac'

const repo = new LeaveRepository()

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params

    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Permission check
        if (!await hasPermission('izin:update')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { status, rejectionReason } = body

        if (!status) return NextResponse.json({ error: 'Status required' }, { status: 400 })

        const result = await repo.update(id, {
            status,
            rejectionReason,
            approvedBy: status === 'APPROVED' ? session.user.id : undefined
        })

        // Notify User
        try {
            const title = status === 'APPROVED' ? '✅ Izin Disetujui' : '❌ Izin Ditolak'
            const message = status === 'APPROVED'
                ? 'Pengajuan izin Anda telah disetujui.'
                : `Pengajuan izin Anda ditolak. Alasan: ${rejectionReason}`

            await createNotification({
                type: 'SYSTEM',
                priority: status === 'APPROVED' ? 'HIGH' : 'NORMAL',
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

        await repo.delete(id)
        return NextResponse.json({ message: 'Deleted successfully' })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
