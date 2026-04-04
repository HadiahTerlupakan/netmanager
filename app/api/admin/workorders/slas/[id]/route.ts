import { prisma } from '@/modules/database';
import { slaUpdateSchema } from '@/lib/validations/sla';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api';

/**
 * GET /api/admin/workorders/slas/{id}
 * Get SLA rule by ID
 */
export const GET = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('wo_sla:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat aturan SLA');
    }

    const { id } = ctx.params;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        return ApiErrors.notFound('Aturan SLA');
    }

    return apiSuccess(sla);
})

/**
 * PUT /api/admin/workorders/slas/{id}
 * Update SLA rule
 */
export const PUT = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('wo_sla:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengupdate aturan SLA');
    }

    const { id } = ctx.params;
    const body = await req.json();
    const validatedData = slaUpdateSchema.parse(body);

    // Check if SLA exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingSLA = await (prisma as any).sLA.findUnique({
        where: { id },
    });

    if (!existingSLA) {
        return ApiErrors.notFound('Aturan SLA');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    return apiSuccess(sla, { message: 'Aturan SLA berhasil diperbarui' });
})

/**
 * DELETE /api/admin/workorders/slas/{id}
 * Delete SLA rule
 */
export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('wo_sla:delete')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus aturan SLA');
    }

    const { id } = ctx.params;

    // Check if SLA exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingSLA = await (prisma as any).sLA.findUnique({
        where: { id },
    });

    if (!existingSLA) {
        return ApiErrors.notFound('Aturan SLA');
    }

    // Check if SLA is being used by any work orders
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workOrdersCount = await (prisma as any).workOrder.count({
        where: { slaId: id },
    });

    if (workOrdersCount > 0) {
        return apiError(
            'Tidak dapat menghapus aturan SLA yang sedang digunakan oleh work order',
            ErrorCodes.VALIDATION_ERROR,
            { status: 400 }
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).sLA.delete({
        where: { id },
    });

    return apiSuccess(null, { message: 'Aturan SLA berhasil dihapus' });
})
