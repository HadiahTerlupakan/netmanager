import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { slaUpdateSchema } from '@/lib/validations/sla';
import { hasPermission } from '@/lib/rbac';

/**
 * @swagger
 * /api/admin/workorders/slas/{id}:
 *   get:
 *     summary: Get SLA rule by ID
 *     description: Mengambil detail aturan SLA berdasarkan ID
 *     tags: [SLA Rules]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: SLA rule ID
 *     responses:
 *       200:
 *         description: SLA rule details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SLA'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: SLA rule not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "SLA rule not found"
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

        if (!await hasPermission('wo_sla:read')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;

        const sla = await (prisma as any).sLA.findUnique({
            where: { id },
            include: {
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
                escalations: {
                    select: {
                        id: true,
                        name: true,
                        escalationLevel: true,
                        triggerCondition: true,
                    },
                },
                workOrders: {
                    select: {
                        id: true,
                        workOrderNumber: true,
                        title: true,
                        status: true,
                    },
                    take: 5,
                    orderBy: {
                        createdAt: 'desc',
                    },
                },
            },
        });

        if (!sla) {
            return NextResponse.json({ error: 'SLA rule not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: sla,
        });
    } catch (error) {
        console.error('Error fetching SLA rule:', error);
        return NextResponse.json({ error: 'Failed to fetch SLA rule' }, { status: 500 });
    }
}

/**
 * @swagger
 * /api/admin/workorders/slas/{id}:
 *   put:
 *     summary: Update SLA rule
 *     description: Memperbarui aturan SLA yang ada
 *     tags: [SLA Rules]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: SLA rule ID
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
 *               workOrderType:
 *                 type: string
 *                 enum: [INSTALLATION, TROUBLESHOOT, MAINTENANCE, UPGRADE, RELOCATION, DISCONNECTION, OTHER]
 *               priority:
 *                 type: string
 *                 enum: [LOW, NORMAL, HIGH, URGENT, CRITICAL]
 *               departmentId:
 *                 type: string
 *               responseTime:
 *                 type: integer
 *               resolutionTime:
 *                 type: integer
 *               businessHoursOnly:
 *                 type: boolean
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: SLA rule updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SLA'
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
 *         description: SLA rule not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "SLA rule not found"
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

        if (!await hasPermission('wo_sla:update')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const validatedData = slaUpdateSchema.parse(body);

        // Check if SLA exists
        const existingSLA = await (prisma as any).sLA.findUnique({
            where: { id },
        });

        if (!existingSLA) {
            return NextResponse.json({ error: 'SLA rule not found' }, { status: 404 });
        }

        const sla = await (prisma as any).sLA.update({
            where: { id },
            data: {
                ...validatedData,
                updatedAt: new Date(),
            },
            include: {
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
                escalations: {
                    select: {
                        id: true,
                        name: true,
                        escalationLevel: true,
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            data: sla,
            message: 'SLA rule updated successfully',
        });
    } catch (error) {
        console.error('Error updating SLA rule:', error);
        return NextResponse.json({ error: 'Failed to update SLA rule' }, { status: 500 });
    }
}

/**
 * @swagger
 * /api/admin/workorders/slas/{id}:
 *   delete:
 *     summary: Delete SLA rule
 *     description: Menghapus aturan SLA
 *     tags: [SLA Rules]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: SLA rule ID
 *     responses:
 *       200:
 *         description: SLA rule deleted successfully
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
 *         description: SLA rule not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "SLA rule not found"
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

        if (!await hasPermission('wo_sla:delete')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;

        // Check if SLA exists
        const existingSLA = await (prisma as any).sLA.findUnique({
            where: { id },
        });

        if (!existingSLA) {
            return NextResponse.json({ error: 'SLA rule not found' }, { status: 404 });
        }

        // Check if SLA is being used by any work orders
        const workOrdersCount = await (prisma as any).workOrder.count({
            where: { slaId: id },
        });

        if (workOrdersCount > 0) {
            return NextResponse.json({ 
                error: 'Cannot delete SLA rule that is being used by work orders' 
            }, { status: 400 });
        }

        await (prisma as any).sLA.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: 'SLA rule deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting SLA rule:', error);
        return NextResponse.json({ error: 'Failed to delete SLA rule' }, { status: 500 });
    }
}