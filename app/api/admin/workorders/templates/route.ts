import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import crypto from 'crypto';
import { workOrderTemplateCreateSchema, workOrderTemplateQuerySchema } from '@/lib/validations/workorder-template';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors } from '@/lib/api-response';

/**
 * @swagger
 * /api/admin/workorders/templates:
 *   get:
 *     summary: Get all work order templates
 *     tags: [Work Order Templates]
 */
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('wo_template:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat template work order');
        }

        const { searchParams } = new URL(request.url);
        const query = workOrderTemplateQuerySchema.parse({
            page: searchParams.get('page') || '1',
            limit: searchParams.get('limit') || '20',
            search: searchParams.get('search') || '',
            type: searchParams.get('type') || undefined,
            priority: searchParams.get('priority') || undefined,
            departmentId: searchParams.get('departmentId') || '',
            isActive: searchParams.get('isActive') || undefined,
            sortBy: searchParams.get('sortBy') || 'createdAt',
            sortOrder: searchParams.get('sortOrder') || 'desc',
        });

        const where: Record<string, unknown> = {};

        if (query.search) {
            where.OR = [
                { name: { contains: query.search, mode: 'insensitive' } },
                { description: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        if (query.type) {
            where.type = query.type;
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

        const [templates, total] = await Promise.all([
            prisma.workOrderTemplates.findMany({
                where: where as import('@prisma/client').Prisma.WorkOrderTemplatesWhereInput,
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
                orderBy: {
                    [query.sortBy]: query.sortOrder,
                },
                skip: (query.page - 1) * query.limit,
                take: query.limit,
            }),
            prisma.workOrderTemplates.count({ where: where as import('@prisma/client').Prisma.WorkOrderTemplatesWhereInput }),
        ]);

        return apiSuccess({
            data: templates,
            pagination: {
                page: query.page,
                limit: query.limit,
                total,
                totalPages: Math.ceil(total / query.limit),
            },
        });
    } catch (error) {
        console.error('Error fetching work order templates:', error);
        return ApiErrors.internalError('Gagal mengambil template work order');
    }
}

/**
 * @swagger
 * /api/admin/workorders/templates:
 *   post:
 *     summary: Create new work order template
 *     tags: [Work Order Templates]
 */
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('wo_template:create')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat template work order');
        }

        const body = await request.json();
        const validatedData = workOrderTemplateCreateSchema.parse(body);

        const { departmentId, ...rest } = validatedData;

        const template = await prisma.workOrderTemplates.create({
            data: {
                ...rest,
                id: crypto.randomUUID(),
                updatedAt: new Date(),
                departments: departmentId ? { connect: { id: departmentId } } : undefined,
                user: { connect: { id: user.id } },
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

        return apiSuccess(template, { status: 201, message: 'Template work order berhasil dibuat' });
    } catch (error) {
        console.error('Error creating work order template:', error);
        return ApiErrors.internalError('Gagal membuat template work order');
    }
}