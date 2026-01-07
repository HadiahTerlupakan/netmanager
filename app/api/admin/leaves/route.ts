import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { LeaveRepository } from '@/modules/attendance/repositories/LeaveRepository'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

const repo = new LeaveRepository()

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Permission check
        if (!await hasPermission('izin:read')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')
        let siteId = searchParams.get('siteId')
        let departmentId = searchParams.get('departmentId')

        // NEW: Enforce RBAC Restrictions
        const user = session.user as any;
        const isSuperAdmin = user.role === 'SUPER_ADMIN';

        if (user.permissions?.includes('izin:site_only') && !isSuperAdmin) {
            siteId = user.siteId;
        }
        if (user.permissions?.includes('izin:department_only') && !isSuperAdmin) {
            departmentId = user.departmentId;
        }

        const leaves = await repo.findAll({
            status: status as any,
            siteId: siteId || undefined,
            departmentId: departmentId || undefined
        })

        return NextResponse.json(leaves)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        // Permission check
        if (!await hasPermission('izin:create')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { userId, type, startDate, endDate, reason, attachmentUrl } = body

        if (!userId || !type || !startDate || !endDate || !reason) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        const result = await repo.create({
            user: { connect: { id: userId } },
            type,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            reason,
            attachmentUrl,
            status: 'APPROVED', // Auto-approve for manual admin entry
            approvedBy: session.user.id
        })

        return NextResponse.json(result)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
