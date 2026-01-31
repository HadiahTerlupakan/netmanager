import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { workOrderEscalationUpdateSchema } from '@/lib/validations/workorder-escalation';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors } from '@/lib/api-response';

/**
 * @swagger
 * /api/admin/workorders/escalations/{id}:
 *   get:
 *     summary: Get escalation rule by ID
 *     tags: [Escalation Rules]
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

        if (!await hasPermission('wo_escalation:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat aturan eskalasi');
        }

        const { id } = await params;

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
    } catch (error) {
        console.error('Error fetching escalation rule:', error);
        return ApiErrors.internalError('Gagal mengambil aturan eskalasi');
    }
}

/**
 * @swagger
 * /api/admin/workorders/escalations/{id}:
 *   put:
 *     summary: Update escalation rule
 *     tags: [Escalation Rules]
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

        if (!await hasPermission('wo_escalation:update')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengupdate aturan eskalasi');
        }

        const { id } = await params;
        const body = await request.json();
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
    } catch (error) {
        console.error('Error updating escalation rule:', error);
        return ApiErrors.internalError('Gagal memperbarui aturan eskalasi');
    }
}

/**
 * @swagger
 * /api/admin/workorders/escalations/{id}:
 *   delete:
 *     summary: Delete escalation rule
 *     tags: [Escalation Rules]
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

        if (!await hasPermission('wo_escalation:delete')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus aturan eskalasi');
        }

        const { id } = await params;

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
    } catch (error) {
        console.error('Error deleting escalation rule:', error);
        return ApiErrors.internalError('Gagal menghapus aturan eskalasi');
    }
}