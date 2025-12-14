import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { workOrderTemplateUpdateSchema } from '@/lib/validations/workorder-template';

/**
 * @swagger
 * /api/admin/workorders/templates/{id}:
 *   get:
 *     summary: Get work order template by ID
 *     description: Mengambil detail template work order berdasarkan ID
 *     tags: [Work Order Templates]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Template ID
 *     responses:
 *       200:
 *         description: Work order template details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/WorkOrderTemplate'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Template not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Work order template not found"
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

        const template = await (prisma as any).workOrderTemplate.findUnique({
            where: { id },
            include: {
                department: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                createdBy: {
                    select: {
                        id: true,
                        fullName: true,
                    },
                },
            },
        });

        if (!template) {
            return NextResponse.json({ error: 'Work order template not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: template,
        });
    } catch (error) {
        console.error('Error fetching work order template:', error);
        return NextResponse.json({ error: 'Failed to fetch work order template' }, { status: 500 });
    }
}

/**
 * @swagger
 * /api/admin/workorders/templates/{id}:
 *   put:
 *     summary: Update work order template
 *     description: Memperbarui template work order yang ada
 *     tags: [Work Order Templates]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Template ID
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
 *               type:
 *                 type: string
 *                 enum: [INSTALLATION, TROUBLESHOOT, MAINTENANCE, UPGRADE, RELOCATION, DISCONNECTION, OTHER]
 *               priority:
 *                 type: string
 *                 enum: [LOW, NORMAL, HIGH, URGENT, CRITICAL]
 *               departmentId:
 *                 type: string
 *               estimatedHours:
 *                 type: number
 *               estimatedCost:
 *                 type: number
 *               requiredMaterials:
 *                 type: object
 *               tasks:
 *                 type: array
 *               checklist:
 *                 type: array
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Work order template updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/WorkOrderTemplate'
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
 *         description: Template not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Work order template not found"
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
        const validatedData = workOrderTemplateUpdateSchema.parse(body);

        // Check if template exists
        const existingTemplate = await (prisma as any).workOrderTemplate.findUnique({
            where: { id },
        });

        if (!existingTemplate) {
            return NextResponse.json({ error: 'Work order template not found' }, { status: 404 });
        }

        const template = await (prisma as any).workOrderTemplate.update({
            where: { id },
            data: {
                ...validatedData,
                updatedAt: new Date(),
            },
            include: {
                department: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                createdBy: {
                    select: {
                        id: true,
                        fullName: true,
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            data: template,
            message: 'Work order template updated successfully',
        });
    } catch (error) {
        console.error('Error updating work order template:', error);
        return NextResponse.json({ error: 'Failed to update work order template' }, { status: 500 });
    }
}

/**
 * @swagger
 * /api/admin/workorders/templates/{id}:
 *   delete:
 *     summary: Delete work order template
 *     description: Menghapus template work order
 *     tags: [Work Order Templates]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Template ID
 *     responses:
 *       200:
 *         description: Work order template deleted successfully
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
 *         description: Template not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Work order template not found"
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

        // Check if template exists
        const existingTemplate = await (prisma as any).workOrderTemplate.findUnique({
            where: { id },
        });

        if (!existingTemplate) {
            return NextResponse.json({ error: 'Work order template not found' }, { status: 404 });
        }

        // Check if template is being used by any work orders
        const workOrdersCount = await (prisma as any).workOrder.count({
            where: { templateId: id },
        });

        if (workOrdersCount > 0) {
            return NextResponse.json({ 
                error: 'Cannot delete template that is being used by work orders' 
            }, { status: 400 });
        }

        await (prisma as any).workOrderTemplate.delete({
            where: { id },
        });

        return NextResponse.json({
            success: true,
            message: 'Work order template deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting work order template:', error);
        return NextResponse.json({ error: 'Failed to delete work order template' }, { status: 500 });
    }
}