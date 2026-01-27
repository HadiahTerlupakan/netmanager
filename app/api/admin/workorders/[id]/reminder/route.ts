import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAuth } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { sendWorkOrderReminder } from '@/modules/work-order/services/WorkOrderNotifications'

/**
 * POST /api/admin/workorders/[id]/reminder
 * Send push notification reminder to technicians for pending work order
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await verifyAuth(request)
        if (!session?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check permission
        // hasPermission expects (permission, userObject?)
        if (!await hasPermission('workorders:reminder', session)) {
            return NextResponse.json({ error: 'Forbidden: Missing workorders:reminder permission' }, { status: 403 })
        }

        const { id } = await params

        // Get work order details
        const workOrder = await prisma.workOrders.findUnique({
            where: { id },
            select: {
                id: true,
                workOrderNumber: true,
                title: true,
                type: true,
                priority: true,
                status: true,
                departmentId: true,
                siteId: true,
                assignedToId: true,
            }
        })

        if (!workOrder) {
            return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
        }

        // Only allow reminder for PENDING, ASSIGNED, or IN_PROGRESS status
        if (!['PENDING', 'ASSIGNED', 'IN_PROGRESS'].includes(workOrder.status)) {
            return NextResponse.json({ 
                error: 'Reminder hanya bisa dikirim untuk WO dengan status Pending, Assigned, atau In Progress' 
            }, { status: 400 })
        }

        // Get optional custom message and target department from body
        let customMessage: string | undefined
        let targetDepartmentId: string | undefined
        try {
            const body = await request.json()
            customMessage = body.message
            targetDepartmentId = body.departmentId // Override department for targeted reminder
        } catch {
            // No body is fine
        }

        // Send reminder notification
        // If targetDepartmentId is provided, use it instead of WO's departmentId
        const sentCount = await sendWorkOrderReminder(
            {
                id: workOrder.id,
                workOrderNumber: workOrder.workOrderNumber,
                title: workOrder.title,
                type: workOrder.type,
                priority: workOrder.priority,
                departmentId: targetDepartmentId || workOrder.departmentId,
                siteId: workOrder.siteId,
                assignedToId: workOrder.assignedToId,
            },
            customMessage
        )

        return NextResponse.json({
            success: true,
            message: `Reminder terkirim ke ${sentCount} teknisi`,
            sentCount,
        })

    } catch (error) {
        console.error('Error sending reminder:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
