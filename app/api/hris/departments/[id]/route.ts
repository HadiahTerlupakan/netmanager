import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { DepartmentRepository } from '@/lib/repositories/DepartmentRepository'

const deptRepo = new DepartmentRepository()

// GET /api/hris/departments/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const department = await deptRepo.findById(params.id)
        if (!department) {
            return NextResponse.json({ error: 'Department not found' }, { status: 404 })
        }

        return NextResponse.json(department)
    } catch (error: any) {
        console.error('Error fetching department:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}

// PUT /api/hris/departments/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (session.user.role !== 'ADMIN' && session.user.role !== 'HR') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await req.json()
        await deptRepo.update(params.id, body)

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error updating department:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}

// DELETE /api/hris/departments/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
        }

        await deptRepo.delete(params.id)
        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error deleting department:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
