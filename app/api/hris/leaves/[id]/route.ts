import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { LeaveRequestRepository, LeaveBalanceRepository } from '@/lib/repositories/LeaveRepository'

const leaveRepo = new LeaveRequestRepository()
const balanceRepo = new LeaveBalanceRepository()

// GET /api/hris/leaves/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        const leave = await leaveRepo.findById(id)
        if (!leave) {
            return NextResponse.json({ error: 'Leave request not found' }, { status: 404 })
        }

        return NextResponse.json(leave)
    } catch (error: any) {
        console.error('Error fetching leave:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}

// PUT /api/hris/leaves/[id] - Update leave request (approve/reject)
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
        const { status, rejectionReason } = body
        const { id } = await params

        // Get the leave request
        const leave = await leaveRepo.findById(id)
        if (!leave) {
            return NextResponse.json({ error: 'Leave request not found' }, { status: 404 })
        }

        const updateData: any = {
            status,
            approvedBy: session.user.id,
            approvedAt: new Date(),
        }

        if (status === 'REJECTED' && rejectionReason) {
            updateData.rejectionReason = rejectionReason
        }

        // If approved, update leave balance
        if (status === 'APPROVED') {
            const currentYear = new Date().getFullYear()
            const balance = await balanceRepo.findByEmployeeAndType(
                leave.employeeId,
                currentYear,
                leave.leaveType
            )

            if (balance) {
                const newUsedDays = balance.usedDays + leave.totalDays
                const newRemainingDays = balance.totalDays - newUsedDays

                await balanceRepo.update(balance.id, {
                    usedDays: newUsedDays,
                    remainingDays: newRemainingDays,
                })
            }
        }

        await leaveRepo.update(id, updateData)
        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error updating leave:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}

// DELETE /api/hris/leaves/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session: any = await getServerSession(authConfig as any)
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        await leaveRepo.delete(id)
        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Error deleting leave:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
