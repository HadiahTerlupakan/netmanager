import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { RegistrationRepository } from '@/modules/registration/repositories/RegistrationRepository'

interface RouteParams {
    params: Promise<{ id: string }>
}

const registrationRepository = new RegistrationRepository()

/**
 * GET /api/admin/registrations/[id] - Get registration detail
 * Refactored to use RegistrationRepository (thin controller pattern)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!(await hasPermission('registration:read'))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id } = await params
        const registration = await registrationRepository.findById(id)

        if (!registration) {
            return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
        }

        return NextResponse.json(registration)
    } catch (error) {
        console.error('Get Registration Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

/**
 * PUT /api/admin/registrations/[id] - Update registration status
 * Refactored to use RegistrationRepository (thin controller pattern)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!(await hasPermission('registration:update'))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id } = await params
        const body = await request.json()
        const { status, rejectionReason, notes } = body

        if (!status) {
            return NextResponse.json({ error: 'Status is required' }, { status: 400 })
        }

        const current = await registrationRepository.findById(id)
        if (!current) {
            return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
        }

        // Validate status transitions
        const validTransitions: Record<string, string[]> = {
            PENDING: ['VERIFIED', 'REJECTED', 'CANCELLED'],
            VERIFIED: ['SURVEYED', 'CANCELLED'],
            SURVEYED: ['INSTALLED', 'CANCELLED'],
            REJECTED: [],
            INSTALLED: [],
            CANCELLED: [],
        }

        const allowedStatuses = validTransitions[current.status] || []
        if (!allowedStatuses.includes(status)) {
            return NextResponse.json({
                error: `Cannot change status from ${current.status} to ${status}`,
                allowedStatuses,
            }, { status: 400 })
        }

        if (status === 'REJECTED' && !rejectionReason) {
            return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
        }

        const updated = await registrationRepository.updateWithDetails(id, {
            status,
            notes: notes !== undefined ? notes : current.notes,
            rejectionReason: status === 'REJECTED' ? rejectionReason : undefined,
            verifiedAt: status === 'VERIFIED' ? new Date() : undefined,
            verifiedBy: status === 'VERIFIED' ? (session.user?.email || 'admin') : undefined,
        })

        return NextResponse.json({
            message: `Status updated to ${status}`,
            data: updated,
        })
    } catch (error) {
        console.error('Update Registration Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

/**
 * DELETE /api/admin/registrations/[id] - Delete registration
 * Refactored to use RegistrationRepository (thin controller pattern)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        if (!(await hasPermission('registration:delete'))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { id } = await params
        await registrationRepository.delete(id)

        return NextResponse.json({ message: 'Registration deleted' })
    } catch (error) {
        console.error('Delete Registration Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
