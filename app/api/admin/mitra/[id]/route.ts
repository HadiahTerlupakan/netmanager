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
    const result = await mitraService.getMitraById(id)

    if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: result.data })
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission('users:update', user, { silent: true }))) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params

    try {
        const body = await request.json()
        const result = await mitraService.updateMitra(id, body, user.id!)

        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 400 })
        }

        return NextResponse.json({ success: true })
    } catch {
        return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission('users:delete', user, { silent: true }))) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const result = await mitraService.deleteMitra(id, user.id!)

    if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
}
