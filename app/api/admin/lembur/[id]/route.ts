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

        const { id } = await params
        const body = await request.json()
        const { action, reason, ...updateData } = body 

        // Check ownership & site/dept restrictions first
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

        // Distinguish between APPROVE/REJECT (Verify) vs EDIT (Update)
        if (action === 'approve' || action === 'reject') {
            // VERIFICATION ACTIONS
            if (!await hasPermission('lembur:verify')) {
                return NextResponse.json({ error: 'Forbidden: You need verify permission' }, { status: 403 })
            }

            if (action === 'approve') {
                const result = await service.approveRequest(id, session.user.id || 'system')
                return NextResponse.json(result)
            } else {
                if (!reason) return NextResponse.json({ error: 'Reason required for rejection' }, { status: 400 })
                const result = await service.rejectRequest(id, reason)
                return NextResponse.json(result)
            }
        } else {
            // EDIT DATA ACTIONS (reason, startTime, endTime, etc.)
            if (!await hasPermission('lembur:update')) {
                return NextResponse.json({ error: 'Forbidden: You need update permission' }, { status: 403 })
            }

            // Implement simple update logic via Prisma directly or add updateRequest to Service
            // For now assuming service has update method or we do direct prisma update
            // Since OvertimeService update isn't confirmed, let's look at updating reason/times
            const prisma = await import('@/lib/prisma').then(m => m.prisma)
            
            // Clean up update data
            const cleanData: any = {}
            if (updateData.reason) cleanData.reason = updateData.reason
            if (updateData.startTime) cleanData.startTime = new Date(updateData.startTime)
            if (updateData.endTime) cleanData.endTime = new Date(updateData.endTime)
            
            const result = await prisma.overtime.update({
                where: { id },
                data: cleanData
            })

            return NextResponse.json({ success: true, data: result })
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

        const { id } = await params

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
