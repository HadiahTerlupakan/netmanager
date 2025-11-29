import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { LeaveRequestRepository } from '@/lib/repositories/LeaveRepository'

const leaveRepo = new LeaveRequestRepository()

// GET /api/hris/leaves - List leave requests
export async function GET(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(req.url)
        const employeeId = searchParams.get('employeeId') || undefined
        const status = searchParams.get('status') as any
        const leaveType = searchParams.get('leaveType') as any

        const filters = {
            employeeId,
            status,
            leaveType,
        }

        const leaves = await leaveRepo.findAll(filters)
        const total = await leaveRepo.count(filters)

        return NextResponse.json({ leaves, total })
    } catch (error: any) {
        console.error('Error fetching leaves:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}

// POST /api/hris/leaves - Create leave request
export async function POST(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()

        if (!body.employeeId || !body.leaveType || !body.startDate || !body.endDate || !body.reason) {
            return NextResponse.json(
                { error: 'Missing required fields: employeeId, leaveType, startDate, endDate, reason' },
                { status: 400 }
            )
        }

        // Calculate total days
        const start = new Date(body.startDate)
        const end = new Date(body.endDate)
        const diffTime = Math.abs(end.getTime() - start.getTime())
        const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1 // Include both start and end day

        const data = {
            employeeId: body.employeeId,
            leaveType: body.leaveType,
            startDate: start,
            endDate: end,
            totalDays,
            reason: body.reason,
        }

        const result = await leaveRepo.create(data)
        return NextResponse.json(result, { status: 201 })
    } catch (error: any) {
        console.error('Error creating leave request:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
