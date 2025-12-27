import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/admin/registrations/[id] - Get registration detail
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params

        const registration = await prisma.registrations.findUnique({
            where: { id }
        })

        if (!registration) {
            return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
        }

        return NextResponse.json(registration)
    } catch (error) {
        console.error('Get Registration Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

// PUT /api/admin/registrations/[id] - Update registration status
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        const body = await request.json()
        const { status, rejectionReason, notes } = body

        // Validate required fields
        if (!status) {
            return NextResponse.json({ error: 'Status is required' }, { status: 400 })
        }

        // Get current registration
        const current = await prisma.registrations.findUnique({
            where: { id }
        })

        if (!current) {
            return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
        }

        // Validate status transitions
        const validTransitions: Record<string, string[]> = {
            PENDING: ['VERIFIED', 'REJECTED', 'CANCELLED'],
            VERIFIED: ['SURVEYED', 'CANCELLED'],
            SURVEYED: ['INSTALLED', 'CANCELLED'],
            REJECTED: [], // Terminal state
            INSTALLED: [], // Terminal state
            CANCELLED: [] // Terminal state
        }

        const allowedStatuses = validTransitions[current.status] || []
        if (!allowedStatuses.includes(status)) {
            return NextResponse.json({
                error: `Cannot change status from ${current.status} to ${status}`,
                allowedStatuses
            }, { status: 400 })
        }

        // Require rejection reason when rejecting
        if (status === 'REJECTED' && !rejectionReason) {
            return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
        }

        // Prepare update data
        const updateData: any = {
            status,
            notes: notes !== undefined ? notes : current.notes
        }

        // Set verified info when verifying
        if (status === 'VERIFIED') {
            updateData.verifiedAt = new Date()
            updateData.verifiedBy = session.user?.email || 'admin'
        }

        // Set rejection reason when rejecting
        if (status === 'REJECTED') {
            updateData.rejectionReason = rejectionReason
        }

        const updated = await prisma.registrations.update({
            where: { id },
            data: updateData
        })

        return NextResponse.json({
            message: `Status updated to ${status}`,
            data: updated
        })
    } catch (error) {
        console.error('Update Registration Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

// DELETE /api/admin/registrations/[id] - Delete registration
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params

        await prisma.registrations.delete({
            where: { id }
        })

        return NextResponse.json({ message: 'Registration deleted' })
    } catch (error) {
        console.error('Delete Registration Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
