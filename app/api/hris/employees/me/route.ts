import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { EmployeeRepository } from '@/lib/repositories/EmployeeRepository'

const employeeRepo = new EmployeeRepository()

// GET /api/hris/employees/me - Get current employee from session
export async function GET(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        console.log('[PROFILE] Session:', JSON.stringify(session?.user, null, 2))

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get employee from session
        const employeeId = session.user?.employee?.id
        console.log('[PROFILE] Employee ID from session:', employeeId)

        if (!employeeId) {
            console.log('[PROFILE] No employee ID in session. Session user:', session.user)
            return NextResponse.json({ error: 'Employee not found in session' }, { status: 404 })
        }

        const employee = await employeeRepo.findById(employeeId)
        console.log('[PROFILE] Employee found:', !!employee)

        if (!employee) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
        }

        return NextResponse.json(employee)
    } catch (error: any) {
        console.error('[PROFILE] Error fetching current employee:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}

// PUT /api/hris/employees/me - Update current employee profile
export async function PUT(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const employeeId = session.user?.employee?.id
        if (!employeeId) {
            return NextResponse.json({ error: 'Employee not found in session' }, { status: 404 })
        }

        const body = await req.json()

        // Only allow updating certain fields
        const allowedFields = ['phone', 'address', 'city', 'province', 'postalCode', 'emergencyName', 'emergencyPhone', 'emergencyRelation']
        const data: any = {}

        for (const field of allowedFields) {
            if (body[field] !== undefined) {
                data[field] = body[field]
            }
        }

        await employeeRepo.update(employeeId, data)
        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error updating current employee:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
