import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { slaCreateSchema, slaQuerySchema } from '@/lib/validations/sla';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors } from '@/lib/api-response';

/**
 * @swagger
 * /api/admin/workorders/slas:
 *   get:
 *     summary: Get all SLA rules
 *     tags: [SLA Rules]
 */
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('wo_sla:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat aturan SLA');
        }

        const { searchParams } = new URL(request.url);
        const query = slaQuerySchema.parse({
            page: searchParams.get('page') || '1',
            limit: searchParams.get('limit') || '20',
            search: searchParams.get('search') || '',
            workOrderType: searchParams.get('workOrderType') || undefined,
            priority: searchParams.get('priority') || undefined,
            departmentId: searchParams.get('departmentId') || '',
            isActive: searchParams.get('isActive') || undefined,
            sortBy: searchParams.get('sortBy') || 'createdAt',
            sortOrder: searchParams.get('sortOrder') || 'desc',
        });

        const where: any = {};

        if (query.search) {
            where.OR = [
                { name: { contains: query.search, mode: 'insensitive' } },
                { description: { contains: query.search, mode: 'insensitive' } },
            ];
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

        if (query.isActive !== undefined) {
            where.isActive = query.isActive;
        }

        const [slas, total] = await Promise.all([
            (prisma as any).sLA.findMany({
                where,
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
                orderBy: {
                    [query.sortBy]: query.sortOrder,
                },
                skip: (query.page - 1) * query.limit,
                take: query.limit,
            }),
            (prisma as any).sLA.count({ where }),
        ]);

        return apiSuccess({
            data: slas,
            pagination: {
                page: query.page,
                limit: query.limit,
                total,
                totalPages: Math.ceil(total / query.limit),
            },
        });
    } catch (error) {
        console.error('Error fetching SLA rules:', error);
        return ApiErrors.internalError('Gagal mengambil aturan SLA');
    }
}

/**
 * @swagger
 * /api/admin/workorders/slas:
 *   post:
 *     summary: Create new SLA rule
 *     tags: [SLA Rules]
 */
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('wo_sla:create')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat aturan SLA');
        }

        const body = await request.json();
        const validatedData = slaCreateSchema.parse(body);

        const sla = await (prisma as any).sLA.create({
            data: {
                ...validatedData,
                createdById: user.id,
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

        return apiSuccess(sla, { status: 201, message: 'Aturan SLA berhasil dibuat' });
    } catch (error) {
        console.error('Error creating SLA rule:', error);
        return ApiErrors.internalError('Gagal membuat aturan SLA');
    }
}