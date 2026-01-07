import { NextResponse } from 'next/server'
import { OvertimeService } from '@/modules/overtime'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Permission check
        if (!await hasPermission('lembur:update')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id } = await params
        const body = await request.json()
        const { action, reason } = body // action: 'approve' | 'reject'

        // NEW: Ownership Check
        const existing = await import('@/lib/prisma').then(m => m.prisma.overtime.findUnique({
            where: { id },
            include: { user: true }
        }))

        if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

        const user = session.user as any;
        const isSuperAdmin = user.role === 'SUPER_ADMIN';
        if (!isSuperAdmin) {
             if (user.permissions?.includes('lembur:site_only') && existing.user.siteId !== user.siteId) {
                 return NextResponse.json({ error: 'Forbidden: Restricted to your Site' }, { status: 403 })
             }
             if (user.permissions?.includes('lembur:department_only') && existing.user.departmentId !== user.departmentId) {
                  return NextResponse.json({ error: 'Forbidden: Restricted to your Dept' }, { status: 403 })
             }
        }

        const service = new OvertimeService()

        if (action === 'approve') {
            const result = await service.approveRequest(id, session.user.id || 'system')
            return NextResponse.json(result)
        } else if (action === 'reject') {
            if (!reason) return NextResponse.json({ error: 'Reason required for rejection' }, { status: 400 })
            const result = await service.rejectRequest(id, reason)
            return NextResponse.json(result)
        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
        }

    } catch (error: any) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        )
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Permission check
        if (!await hasPermission('lembur:delete')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // NEW: Ownership Check
        const existing = await import('@/lib/prisma').then(m => m.prisma.overtime.findUnique({
            where: { id },
            include: { user: true }
        }))

        if (existing) {
            const user = session.user as any;
            const isSuperAdmin = user.role === 'SUPER_ADMIN';
            if (!isSuperAdmin) {
                    if (user.permissions?.includes('lembur:site_only') && existing.user.siteId !== user.siteId) {
                        return NextResponse.json({ error: 'Forbidden: Restricted to your Site' }, { status: 403 })
                    }
                    if (user.permissions?.includes('lembur:department_only') && existing.user.departmentId !== user.departmentId) {
                        return NextResponse.json({ error: 'Forbidden: Restricted to your Dept' }, { status: 403 })
                    }
            }
        }

        const { id } = await params
        const service = new OvertimeService()
        await service.deleteOvertime(id)

        return NextResponse.json({ success: true, message: 'Overtime deleted' })
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        )
    }
}
