import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { workOrderTemplateUpdateSchema } from '@/lib/validations/workorder-template';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response';

/**
 * @swagger
 * /api/admin/workorders/templates/{id}:
 *   get:
 *     summary: Get work order template by ID
 *     tags: [Work Order Templates]
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('wo_template:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat template work order');
        }

        const { id } = await params;

        const template = await prisma.workOrderTemplates.findUnique({
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
            },
        });

        if (!template) {
            return ApiErrors.notFound('Template Work Order');
        }

        return apiSuccess(template);
    } catch (error) {
        console.error('Error fetching work order template:', error);
        return ApiErrors.internalError('Gagal mengambil template work order');
    }
}

/**
 * @swagger
 * /api/admin/workorders/templates/{id}:
 *   put:
 *     summary: Update work order template
 *     tags: [Work Order Templates]
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('wo_template:update')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengupdate template work order');
        }

        const { id } = await params;
        const body = await request.json();
        const validatedData = workOrderTemplateUpdateSchema.parse(body);

        // Check if template exists
        const existingTemplate = await prisma.workOrderTemplates.findUnique({
            where: { id },
        });

        if (!existingTemplate) {
            return ApiErrors.notFound('Template Work Order');
        }

        const template = await prisma.workOrderTemplates.update({
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
            },
        });

        return apiSuccess(template, { message: 'Template work order berhasil diperbarui' });
    } catch (error) {
        console.error('Error updating work order template:', error);
        return ApiErrors.internalError('Gagal memperbarui template work order');
    }
}

/**
 * @swagger
 * /api/admin/workorders/templates/{id}:
 *   delete:
 *     summary: Delete work order template
 *     tags: [Work Order Templates]
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('wo_template:delete')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus template work order');
        }

        const { id } = await params;

        // Check if template exists
        const existingTemplate = await prisma.workOrderTemplates.findUnique({
            where: { id },
        });

        if (!existingTemplate) {
            return ApiErrors.notFound('Template Work Order');
        }

        // Check if template is being used by any work orders
        const workOrdersCount = await prisma.workOrders.count({
            where: { templateId: id },
        });

        if (workOrdersCount > 0) {
            return apiError(
                'Tidak dapat menghapus template yang sedang digunakan oleh work order',
                ErrorCodes.VALIDATION_ERROR,
                { status: 400 }
            );
        }

        await prisma.workOrderTemplates.delete({
            where: { id },
        });

        return apiSuccess(null, { message: 'Template work order berhasil dihapus' });
    } catch (error) {
        console.error('Error deleting work order template:', error);
        return ApiErrors.internalError('Gagal menghapus template work order');
    }
}