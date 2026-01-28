import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { slaUpdateSchema } from '@/lib/validations/sla';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response';

/**
 * @swagger
 * /api/admin/workorders/slas/{id}:
 *   get:
 *     summary: Get SLA rule by ID
 *     tags: [SLA Rules]
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

        if (!await hasPermission('wo_sla:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat aturan SLA');
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
            return ApiErrors.notFound('Aturan SLA');
        }

        return apiSuccess(sla);
    } catch (error) {
        console.error('Error fetching SLA rule:', error);
        return ApiErrors.internalError('Gagal mengambil aturan SLA');
    }
}

/**
 * @swagger
 * /api/admin/workorders/slas/{id}:
 *   put:
 *     summary: Update SLA rule
 *     tags: [SLA Rules]
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

        if (!await hasPermission('wo_sla:update')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengupdate aturan SLA');
        }

        const { id } = await params;
        const body = await request.json();
        const validatedData = slaUpdateSchema.parse(body);

        // Check if SLA exists
        const existingSLA = await (prisma as any).sLA.findUnique({
            where: { id },
        });

        if (!existingSLA) {
            return ApiErrors.notFound('Aturan SLA');
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

        return apiSuccess(sla, { message: 'Aturan SLA berhasil diperbarui' });
    } catch (error) {
        console.error('Error updating SLA rule:', error);
        return ApiErrors.internalError('Gagal memperbarui aturan SLA');
    }
}

/**
 * @swagger
 * /api/admin/workorders/slas/{id}:
 *   delete:
 *     summary: Delete SLA rule
 *     tags: [SLA Rules]
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

        if (!await hasPermission('wo_sla:delete')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus aturan SLA');
        }

        const { id } = await params;

        // Check if SLA exists
        const existingSLA = await (prisma as any).sLA.findUnique({
            where: { id },
        });

        if (!existingSLA) {
            return ApiErrors.notFound('Aturan SLA');
        }

        // Check if SLA is being used by any work orders
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

        await (prisma as any).sLA.delete({
            where: { id },
        });

        return apiSuccess(null, { message: 'Aturan SLA berhasil dihapus' });
    } catch (error) {
        console.error('Error deleting SLA rule:', error);
        return ApiErrors.internalError('Gagal menghapus aturan SLA');
    }
}