import { NextRequest, NextResponse } from 'next/server'
import { hasPermission, getCurrentUser } from '@/lib/rbac'
import { getMitraService } from '@/modules/mitra'
import type { EmployeeType } from '@prisma/client'

const mitraService = getMitraService()

export async function GET(request: NextRequest) {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission('users:read', user, { silent: true }))) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || undefined
    const employeeType = searchParams.get('type') as EmployeeType | undefined
    const isActive = searchParams.get('active') !== null ? searchParams.get('active') === 'true' : undefined
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const result = await mitraService.getMitras(
        { search, employeeType, isActive },
        page,
        limit
    )

    if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: result.data })
}

export async function POST(request: NextRequest) {
    const user = await getCurrentUser()
    if (!user || !(await hasPermission('users:create', user, { silent: true }))) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 })
    }

    try {
        const body = await request.json()
        const result = await mitraService.createMitra(body, user.id!)

        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 400 })
        }

        return NextResponse.json({ success: true, data: result.data }, { status: 201 })
    } catch {
        return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
    }
}
