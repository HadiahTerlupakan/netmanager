import { prisma } from '@/modules/database';
import { workOrderEscalationUpdateSchema } from '@/lib/validations/workorder-escalation';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api';

/**
 * GET /api/admin/workorders/escalations/{id}
 * Get escalation rule by ID
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('wo_escalation:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat aturan eskalasi');
    }

    const { id } = ctx.params;

    const escalation = await prisma.workOrderEscalations.findUnique({
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
        return ApiErrors.notFound('Aturan Eskalasi');
    }

    return apiSuccess(escalation);
})

/**
 * PUT /api/admin/workorders/escalations/{id}
 * Update escalation rule
 */
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('wo_escalation:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengupdate aturan eskalasi');
    }

    const { id } = ctx.params;
    const body = await req.json();
    const validatedData = workOrderEscalationUpdateSchema.parse(body);

    // Check if escalation exists
    const existingEscalation = await prisma.workOrderEscalations.findUnique({
        where: { id },
    });

    if (!existingEscalation) {
        return ApiErrors.notFound('Aturan Eskalasi');
    }

    const escalation = await prisma.workOrderEscalations.update({
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

    return apiSuccess(escalation, { message: 'Aturan eskalasi berhasil diperbarui' });
})

/**
 * DELETE /api/admin/workorders/escalations/{id}
 * Delete escalation rule
 */
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('wo_escalation:delete')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus aturan eskalasi');
    }

    const { id } = ctx.params;

    // Check if escalation exists
    const existingEscalation = await prisma.workOrderEscalations.findUnique({
        where: { id },
    });

    if (!existingEscalation) {
        return ApiErrors.notFound('Aturan Eskalasi');
    }

    await prisma.workOrderEscalations.delete({
        where: { id },
    });

    return apiSuccess(null, { message: 'Aturan eskalasi berhasil dihapus' });
})
