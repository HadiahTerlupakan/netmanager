import { NextRequest, NextResponse } from 'next/server'
import { hasPermission, getCurrentUser } from '@/lib/rbac'
import { getMitraService } from '@/modules/mitra'

const mitraService = getMitraService()

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission('users:read', user, { silent: true }))) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    const result = await mitraService.getFaceVerificationLogs(id, user.tenantId as string, page, limit)

    if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: result.data })
}
