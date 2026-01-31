import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { verifyAuth } from '@/lib/auth';
import crypto from 'crypto';
import { workOrderEscalationCreateSchema, workOrderEscalationQuerySchema } from '@/lib/validations/workorder-escalation';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors } from '@/lib/api-response';

/**
 * @swagger
 * /api/admin/workorders/escalations:
 *   get:
 *     summary: Get all escalation rules
 *     tags: [Escalation Rules]
 */
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('wo_escalation:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat aturan eskalasi');
        }

        const { searchParams } = new URL(request.url);
        const query = workOrderEscalationQuerySchema.parse({
            page: searchParams.get('page') || '1',
            limit: searchParams.get('limit') || '20',
            search: searchParams.get('search') || '',
            slaId: searchParams.get('slaId') || '',
            workOrderType: searchParams.get('workOrderType') || undefined,
            priority: searchParams.get('priority') || undefined,
            departmentId: searchParams.get('departmentId') || '',
            escalationLevel: searchParams.get('escalationLevel') || undefined,
            isActive: searchParams.get('isActive') || undefined,
            sortBy: searchParams.get('sortBy') || 'createdAt',
            sortOrder: searchParams.get('sortOrder') || 'desc',
        });

        const where: Prisma.WorkOrderEscalationsWhereInput = {};

        if (query.search) {
            where.OR = [
                { name: { contains: query.search, mode: 'insensitive' } },
                { description: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        if (query.slaId) {
            where.slaId = query.slaId;
        }

        if (query.workOrderType) {
            where.workOrderType = query.workOrderType;
        }

        if (query.priority) {
            where.priority = query.priority;
        }

        if (query.departmentId) {
            where.departmentId = query.departmentId;
        }

        if (query.escalationLevel) {
            where.escalationLevel = query.escalationLevel;
        }

        if (query.isActive !== undefined) {
            where.isActive = query.isActive;
        }

        const [escalations, total] = await Promise.all([
            prisma.workOrderEscalations.findMany({
                where,
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
                orderBy: {
                    [query.sortBy]: query.sortOrder,
                },
                skip: (query.page - 1) * query.limit,
                take: query.limit,
            }),
            prisma.workOrderEscalations.count({ where }),
        ]);

        return apiSuccess({
            data: escalations,
            pagination: {
                page: query.page,
                limit: query.limit,
                total,
                totalPages: Math.ceil(total / query.limit),
            },
        });
    } catch (error) {
        console.error('Error fetching escalation rules:', error);
        return ApiErrors.internalError('Gagal mengambil aturan eskalasi');
    }
}

/**
 * @swagger
 * /api/admin/workorders/escalations:
 *   post:
 *     summary: Create new escalation rule
 *     tags: [Escalation Rules]
 */
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('wo_escalation:create')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat aturan eskalasi');
        }

        const body = await request.json();
        const { departmentId, slaId, ...data } = workOrderEscalationCreateSchema.parse(body);

        const escalation = await prisma.workOrderEscalations.create({
            data: {
                ...data,
                id: crypto.randomUUID(),
                updatedAt: new Date(),
                departments: departmentId ? { connect: { id: departmentId } } : undefined,
                sla: slaId ? { connect: { id: slaId } } : undefined,
                user: { connect: { id: user.id } },
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

        return apiSuccess(escalation, { status: 201, message: 'Aturan eskalasi berhasil dibuat' });
    } catch (error) {
        console.error('Error creating escalation rule:', error);
        return ApiErrors.internalError('Gagal membuat aturan eskalasi');
    }
}