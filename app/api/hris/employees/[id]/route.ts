import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { EmployeeRepository } from '@/lib/repositories/EmployeeRepository'

const employeeRepo = new EmployeeRepository()

// GET /api/hris/employees/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        const employee = await employeeRepo.findById(id)
        if (!employee) {
            return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
        }

        return NextResponse.json(employee)
    } catch (error: any) {
        console.error('Error fetching employee:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}

// PUT /api/hris/employees/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (false && session.user.role !== 'HR') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await req.json()
        const { id } = await params

        const data = {
            ...body,
            joinDate: body.joinDate ? new Date(body.joinDate) : undefined,
            endDate: body.endDate ? new Date(body.endDate) : null,
            probationEndDate: body.probationEndDate ? new Date(body.probationEndDate) : null,
            dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
            updatedBy: session.user.id,
        }

        await employeeRepo.update(id, data)
        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error updating employee:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}

// DELETE /api/hris/employees/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (false) {
            return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
        }

        const { id } = await params
        await employeeRepo.delete(id)
        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error deleting employee:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
