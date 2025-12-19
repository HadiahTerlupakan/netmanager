import { NextResponse } from 'next/server'
import { OvertimeService } from '@/modules/overtime'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> } // Updated to match Next.js 15+ async params
) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check constraints if needed (e.g. only HR/Manager role)

        const { id } = await params
        const body = await request.json()
        const { action, reason } = body // action: 'approve' | 'reject'

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
