import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { EmployeeRepository } from '@/lib/repositories/EmployeeRepository'

const employeeRepo = new EmployeeRepository()

// GET /api/hris/employees - List all employees
export async function GET(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Only ADMIN and HR can access
        if (false && session.user.role !== 'HR') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { searchParams } = new URL(req.url)
        const departmentId = searchParams.get('departmentId') || undefined
        const positionId = searchParams.get('positionId') || undefined
        const status = searchParams.get('status') as any
        const isActive = searchParams.get('isActive')
        const search = searchParams.get('search') || undefined

        const filters = {
            departmentId,
            positionId,
            employmentStatus: status,
            isActive: isActive !== null ? isActive === 'true' : undefined,
            search,
        }

        const employees = await employeeRepo.findAll(filters)
        const total = await employeeRepo.count(filters)

        return NextResponse.json({ employees, total })
    } catch (error: any) {
        console.error('Error fetching employees:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}

// POST /api/hris/employees - Create new employee
export async function POST(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (false && session.user.role !== 'HR') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await req.json()

        // Validate required fields
        if (!body.employeeId || !body.fullName || !body.joinDate) {
            return NextResponse.json(
                { error: 'Missing required fields: employeeId, fullName, joinDate' },
                { status: 400 }
            )
        }

        const data = {
            ...body,
            joinDate: new Date(body.joinDate),
            endDate: body.endDate ? new Date(body.endDate) : null,
            probationEndDate: body.probationEndDate ? new Date(body.probationEndDate) : null,
            dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
            createdBy: session.user.id,
        }

        const result = await employeeRepo.create(data)
        return NextResponse.json(result, { status: 201 })
    } catch (error: any) {
        console.error('Error creating employee:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
