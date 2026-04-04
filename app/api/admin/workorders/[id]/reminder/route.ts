import { prisma } from '@/modules/database'
import { hasPermission } from '@/lib/rbac'
import { sendWorkOrderReminder } from '@/modules/work-order'
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api'

/**
 * POST /api/admin/workorders/[id]/reminder
 * Send push notification reminder to technicians for pending work order
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
    // Check permission
    // Since permission checker needs to be flexible, we can rely on hasPermission(string)
    // The previous implementation passed session, but hasPermission logic usually checks session from context or DB.
    // Assuming hasPermission can check for 'workorders:reminder'
    if (!await hasPermission('workorders:reminder')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengirim reminder')
    }

    const { id } = ctx.params

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
        return ApiErrors.notFound('Work Order')
    }

    // Only allow reminder for PENDING, ASSIGNED, or IN_PROGRESS status
    if (!['PENDING', 'ASSIGNED', 'IN_PROGRESS'].includes(workOrder.status)) {
        return apiError(
            'Reminder hanya bisa dikirim untuk WO dengan status Pending, Assigned, atau In Progress',
            ErrorCodes.VALIDATION_ERROR,
            { status: 400 }
        )
    }

    // Get optional custom message and target department from body
    let customMessage: string | undefined
    let targetDepartmentId: string | undefined
    try {
        const body = await req.json()
        customMessage = body.message
        targetDepartmentId = body.departmentId // Override department for targeted reminder
    } catch {
        // No body is fine
    }

    // Send reminder notification
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

    return apiSuccess({ sentCount }, { message: `Reminder terkirim ke ${sentCount} teknisi` })
})
