import { NextRequest, NextResponse } from 'next/server'
import { hasPermission, getCurrentUser } from '@/lib/rbac'
import { getMitraWithdrawService } from '@/modules/mitra'

const withdrawService = getMitraWithdrawService()

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission('users:update', user, { silent: true }))) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    try {
        let result

        switch (action) {
            case 'approve':
                result = await withdrawService.approveWithdraw(id, user.id!)
                break
            case 'reject': {
                const body = await request.json()
                result = await withdrawService.rejectWithdraw(id, body.reason || 'Ditolak oleh admin', user.id!)
                break
            }
            case 'complete':
                result = await withdrawService.completeWithdraw(id, user.id!)
                break
            default:
                return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
        }

        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 400 })
        }

        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
    }
}
