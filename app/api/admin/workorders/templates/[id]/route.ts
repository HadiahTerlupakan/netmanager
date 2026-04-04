import { prisma } from '@/modules/database';
import { workOrderTemplateUpdateSchema } from '@/lib/validations/workorder-template';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api';

/**
 * GET /api/admin/workorders/templates/{id}
 * Get work order template by ID
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('wo_template:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat template work order');
    }

    const { id } = ctx.params;

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
})

/**
 * PUT /api/admin/workorders/templates/{id}
 * Update work order template
 */
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('wo_template:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengupdate template work order');
    }

    const { id } = ctx.params;
    const body = await req.json();
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
})

/**
 * DELETE /api/admin/workorders/templates/{id}
 * Delete work order template
 */
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('wo_template:delete')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus template work order');
    }

    const { id } = ctx.params;

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
})
