import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { DepartmentRepository } from '@/lib/repositories/DepartmentRepository'

const deptRepo = new DepartmentRepository()

// GET /api/hris/departments - List all departments
export async function GET(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const departments = await deptRepo.findAll()
        const total = await deptRepo.count()

        return NextResponse.json({ departments, total })
    } catch (error: any) {
        console.error('Error fetching departments:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}

// POST /api/hris/departments - Create new department
export async function POST(req: NextRequest) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (session.user.role !== 'ADMIN' && session.user.role !== 'HR') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await req.json()

        if (!body.name) {
            return NextResponse.json({ error: 'Department name is required' }, { status: 400 })
        }

        const result = await deptRepo.create(body)
        return NextResponse.json(result, { status: 201 })
    } catch (error: any) {
        console.error('Error creating department:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
