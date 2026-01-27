import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SalaryRepository } from '@/modules/salary/repositories/SalaryRepository'

const salaryRepo = new SalaryRepository()

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * GET /api/admin/salary/[id] - Get salary detail
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        const salary = await salaryRepo.findById(id)

        if (!salary) {
            return NextResponse.json({ error: 'Salary not found' }, { status: 404 })
        }

        return NextResponse.json({ salary })
    } catch (error) {
        console.error('Error fetching salary:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch salary' },
            { status: 500 }
        )
    }
}

/**
 * PUT /api/admin/salary/[id] - Update salary detail (for revision)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        const body = await request.json()

        const salary = await salaryRepo.findById(id)
        if (!salary) {
            return NextResponse.json({ error: 'Salary not found' }, { status: 404 })
        }

        // Only allow update if status is CALCULATED or REVISED
        if (!['CALCULATED', 'REVISED'].includes(salary.status)) {
            return NextResponse.json(
                { error: `Cannot update salary with status: ${salary.status}` },
                { status: 400 }
            )
        }

        // Update allowed fields
        const updateData: any = {}
        if (body.auditNotes !== undefined) updateData.auditNotes = body.auditNotes

        const updated = await salaryRepo.update(id, updateData)

        return NextResponse.json({ 
            success: true, 
            salary: updated 
        })
    } catch (error) {
        console.error('Error updating salary:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to update salary' },
            { status: 500 }
        )
    }
}

/**
 * DELETE /api/admin/salary/[id] - Delete salary record
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        const salary = await salaryRepo.findById(id)

        if (!salary) {
            return NextResponse.json({ error: 'Salary not found' }, { status: 404 })
        }

        // Only allow delete if status is DRAFT or CALCULATED
        if (!['DRAFT', 'CALCULATED'].includes(salary.status)) {
            return NextResponse.json(
                { error: `Cannot delete salary with status: ${salary.status}` },
                { status: 400 }
            )
        }

        await salaryRepo.delete(id)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Error deleting salary:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to delete salary' },
            { status: 500 }
        )
    }
}
