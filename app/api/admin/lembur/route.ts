import { NextResponse } from 'next/server'
import { OvertimeService } from '@/modules/overtime'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Permission check
        if (!await hasPermission('lembur:read')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')
        const skip = (page - 1) * limit

        const siteId = searchParams.get('siteId') || undefined
        const departmentId = searchParams.get('departmentId') || undefined
        const status = searchParams.get('status') || undefined
        const startDateStr = searchParams.get('startDate')
        const endDateStr = searchParams.get('endDate')

        const filters: any = { skip, take: limit, siteId, departmentId, status }

        if (startDateStr && endDateStr) {
            const start = new Date(startDateStr)
            start.setHours(0, 0, 0, 0)
            const end = new Date(endDateStr)
            end.setHours(23, 59, 59, 999)
            filters.startDate = start
            filters.endDate = end
        }

        const service = new OvertimeService()
        const result = await service.getAllRequests(filters)

        return NextResponse.json({
            success: true,
            data: result.data,
            summary: result.summary,
            pagination: {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit)
            }
        })
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        )
    }
}
