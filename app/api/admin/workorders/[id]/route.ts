import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/lib/repositories/WorkOrderRepository';
import { requireAuth } from '@/lib/auth-helpers';

const workOrderRepo = new WorkOrderRepository(prisma);

/**
 * @swagger
 * /api/admin/workorders/{id}:
 *   get:
 *     summary: Get work order detail
 *     description: Retrieve detailed information about a specific work order
 *     tags: [Work Orders]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Work order ID
 *     responses:
 *       200:
 *         description: Work order details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/WorkOrder'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Work order not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Work order not found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/admin/workorders/[id] - Get work order detail
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth(request);
        if (user instanceof NextResponse) {
            return user; // Return error response if authentication fails
        }

        const { id } = await params;
        const workOrder = await workOrderRepo.findById(id);

        if (!workOrder) {
            return NextResponse.json({ error: 'Work order not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: workOrder,
        });
    } catch (error) {
        console.error('Error fetching work order:', error);
        return NextResponse.json({ error: 'Failed to fetch work order' }, { status: 500 });
    }
}

/**
 * @swagger
 * /api/admin/workorders/{id}:
 *   patch:
 *     summary: Update work order
 *     description: |
 *       Update work order information including status and other fields.
 *       Can add rejection reason which will be recorded as an update note.
 *       Status changes are handled separately from other field updates.
 *     tags: [Work Orders]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Work order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [OPEN, IN_PROGRESS, COMPLETED, CANCELLED]
 *                 description: New work order status
 *               rejectionReason:
 *                 type: string
 *                 description: Reason for rejection (will be added as note)
 *               title:
 *                 type: string
 *                 description: Work order title
 *               description:
 *                 type: string
 *                 description: Work order description
 *               type:
 *                 type: string
 *                 enum: [INSTALLATION, MAINTENANCE, TROUBLESHOOTING, RELOCATION]
 *                 description: Work order type
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *                 description: Work order priority
 *               pelangganId:
 *                 type: string
 *                 description: Customer ID
 *               assignedDepartmentId:
 *                 type: string
 *                 description: Assigned department ID
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *                 description: Scheduled date
 *     responses:
 *       200:
 *         description: Work order updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/WorkOrder'
 *                 message:
 *                   type: string
 *                   example: "Work order updated successfully"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// PATCH /api/admin/workorders/[id] - Update work order
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth(request);
        if (user instanceof NextResponse) {
            return user; // Return error response if authentication fails
        }

        const { id } = await params;
        const body = await request.json();

        // Handle rejection reason or explicitly provided reason
        if (body.rejectionReason) {
            await workOrderRepo.addUpdate({
                workOrderId: id,
                updateType: 'NOTE',
                message: `[REJECTED] ${body.rejectionReason}`,
                createdById: user.id,
            });
            delete body.rejectionReason;
        }

        // Handle status change separately if provided
        if (body.status) {
            await workOrderRepo.updateStatus(id, body.status, user.id);
            delete body.status;
        }

        // Update other fields if any
        if (Object.keys(body).length > 0) {
            await workOrderRepo.update(id, body);
        }

        const workOrder = await workOrderRepo.findById(id);

        // System Log
        try {
            const { logger } = await import('@/lib/logger')
            await logger.logActivity({
                action: 'UPDATE',
                subject: 'Work Order',
                userId: user.id,
                details: { id, updates: body }
            })
        } catch (e) {
            console.error('Logging failed', e)
        }

        return NextResponse.json({
            success: true,
            data: workOrder,
            message: 'Work order updated successfully',
        });
    } catch (error) {
        console.error('Error updating work order:', error);
        return NextResponse.json({ error: 'Failed to update work order' }, { status: 500 });
    }
}

/**
 * @swagger
 * /api/admin/workorders/{id}:
 *   delete:
 *     summary: Delete/cancel work order
 *     description: Cancel a work order with optional reason
 *     tags: [Work Orders]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Work order ID
 *       - in: query
 *         name: reason
 *         schema:
 *           type: string
 *           default: "Cancelled by admin"
 *         description: Reason for cancellation
 *     responses:
 *       200:
 *         description: Work order cancelled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Work order cancelled successfully"
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// DELETE /api/admin/workorders/[id] - Delete/cancel work order
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await requireAuth(request);
        if (user instanceof NextResponse) {
            return user; // Return error response if authentication fails
        }

        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const reason = searchParams.get('reason') || 'Cancelled by admin';

        await workOrderRepo.cancel(id, reason, user.id);

        // System Log
        try {
            const { logger } = await import('@/lib/logger')
            await logger.logActivity({
                action: 'DELETE',
                subject: 'Work Order',
                userId: user.id,
                details: { id, reason }
            })
        } catch (e) {
            console.error('Logging failed', e)
        }

        return NextResponse.json({
            success: true,
            message: 'Work order cancelled successfully',
        });
    } catch (error) {
        console.error('Error cancelling work order:', error);
        return NextResponse.json({ error: 'Failed to cancel work order' }, { status: 500 });
    }
}
