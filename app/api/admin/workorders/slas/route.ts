import { prisma } from '@/modules/database';
import { slaCreateSchema, slaQuerySchema } from '@/lib/validations/sla';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api';

/**
 * GET /api/admin/workorders/slas
 * Get all SLA rules
 */
export const GET = createHandler({ auth: true }, async (req, _ctx) => {
    if (!await hasPermission('wo_sla:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat aturan SLA');
    }

    const { searchParams } = req.nextUrl;
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

    const where: Record<string, unknown> = {};

    if (query.search) {
        where.OR = [
            { name: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
        ];
    }

    if (query.workOrderType) where.workOrderType = query.workOrderType;
    if (query.priority) where.priority = query.priority;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    const [slas, total] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
})

/**
 * POST /api/admin/workorders/slas
 * Create new SLA rule
 */
export const POST = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('wo_sla:create')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat aturan SLA');
    }

    const body = await req.json();
    const validatedData = slaCreateSchema.parse(body);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sla = await (prisma as any).sLA.create({
        data: {
            ...validatedData,
            createdById: ctx.session!.user.id,
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
})
