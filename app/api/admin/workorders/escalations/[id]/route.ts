import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { workOrderEscalationUpdateSchema } from '@/lib/validations/workorder-escalation';

/**
 * @swagger
 * /api/admin/workorders/escalations/{id}:
 *   get:
 *     summary: Get escalation rule by ID
 *     description: Mengambil detail aturan eskalasi berdasarkan ID
 *     tags: [Escalation Rules]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Escalation rule ID
 *     responses:
 *       200:
 *         description: Escalation rule details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/WorkOrderEscalation'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Escalation rule not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Escalation rule not found"
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        const escalation = await (prisma as any).workOrderEscalations.findUnique({
            where: { id },
            include: {
                sla: {
                    select: {
                        id: true,
                        name: true,
                        responseTime: true,
                        resolutionTime: true,
                    },
                },
                departments: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        if (!escalation) {
            return NextResponse.json({ error: 'Escalation rule not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: escalation,
        });
    } catch (error) {
        console.error('Error fetching escalation rule:', error);
        return NextResponse.json({ error: 'Failed to fetch escalation rule' }, { status: 500 });
    }
}

/**
 * @swagger
 * /api/admin/workorders/escalations/{id}:
 *   put:
 *     summary: Update escalation rule
 *     description: Memperbarui aturan eskalasi yang ada
 *     tags: [Escalation Rules]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Escalation rule ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               slaId:
 *                 type: string
 *               workOrderType:
 *                 type: string
 *                 enum: [INSTALLATION, TROUBLESHOOT, MAINTENANCE, UPGRADE, RELOCATION, DISCONNECTION, OTHER]
 *               priority:
 *                 type: string
 *                 enum: [LOW, NORMAL, HIGH, URGENT, CRITICAL]
 *               departmentId:
 *                 type: string
 *               triggerCondition:
 *                 type: string
 *               escalationLevel:
 *                 type: integer
 *               notifyRole:
 *                 type: string
 *               notifyEmployees:
 *                 type: array
 *                 items:
 *                   type: string
 *               notifyDepartments:
 *                 type: array
 *                 items:
 *                   type: string
 *               delayMinutes:
 *                 type: integer
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Escalation rule updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/WorkOrderEscalation'
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Escalation rule not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Escalation rule not found"
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const validatedData = workOrderEscalationUpdateSchema.parse(body);

        // Check if escalation exists
        const existingEscalation = await (prisma as any).workOrderEscalations.findUnique({
            where: { id },
        });

        if (!existingEscalation) {
            return NextResponse.json({ error: 'Escalation rule not found' }, { status: 404 });
        }

        const escalation = await (prisma as any).workOrderEscalations.update({
            where: { id },
            data: {
                ...validatedData,
                updatedAt: new Date(),
            },
            include: {
                sla: {
                    select: {
                        id: true,
                        name: true,
                        responseTime: true,
                        resolutionTime: true,
                    },
                },
                departments: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            data: escalation,
            message: 'Escalation rule updated successfully',
        });
    } catch (error) {
        console.error('Error updating escalation rule:', error);
        return NextResponse.json({ error: 'Failed to update escalation rule' }, { status: 500 });
    }
}

/**
 * @swagger
 * /api/admin/workorders/escalations/{id}:
 *   delete:
 *     summary: Delete escalation rule
 *     description: Menghapus aturan eskalasi
 *     tags: [Escalation Rules]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Escalation rule ID
 *     responses:
 *       200:
 *         description: Escalation rule deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Escalation rule not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Escalation rule not found"
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;

        // Check if escalation exists
        const existingEscalation = await (prisma as any).workOrderEscalations.findUnique({
            where: { id },
        });

        if (!existingEscalation) {
            return NextResponse.json({ error: 'Escalation rule not found' }, { status: 404 });
        }

        await (prisma as any).workOrderEscalations.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: 'Escalation rule deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting escalation rule:', error);
        return NextResponse.json({ error: 'Failed to delete escalation rule' }, { status: 500 });
    }
}