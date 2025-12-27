import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { slaCreateSchema, slaQuerySchema } from '@/lib/validations/sla';

/**
 * @swagger
 * /api/admin/workorders/slas:
 *   get:
 *     summary: Get all SLA rules
 *     description: Mengambil daftar semua aturan SLA dengan filter dan pagination
 *     tags: [SLA Rules]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in name and description
 *       - in: query
 *         name: workOrderType
 *         schema:
 *           type: string
 *           enum: [INSTALLATION, TROUBLESHOOT, MAINTENANCE, UPGRADE, RELOCATION, DISCONNECTION, OTHER]
 *         description: Filter by work order type
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [LOW, NORMAL, HIGH, URGENT, CRITICAL]
 *         description: Filter by priority
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *         description: Filter by department
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of SLA rules
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SLA'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

        return NextResponse.json({
            success: true,
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
        return NextResponse.json({ error: 'Failed to fetch SLA rules' }, { status: 500 });
    }
}

/**
 * @swagger
 * /api/admin/workorders/slas:
 *   post:
 *     summary: Create new SLA rule
 *     description: Membuat aturan SLA baru
 *     tags: [SLA Rules]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - responseTime
 *               - resolutionTime
 *             properties:
 *               name:
 *                 type: string
 *                 example: SLA Standar Instalasi
 *               description:
 *                 type: string
 *                 example: SLA untuk pekerjaan instalasi standar
 *               workOrderType:
 *                 type: string
 *                 enum: [INSTALLATION, TROUBLESHOOT, MAINTENANCE, UPGRADE, RELOCATION, DISCONNECTION, OTHER]
 *               priority:
 *                 type: string
 *                 enum: [LOW, NORMAL, HIGH, URGENT, CRITICAL]
 *               departmentId:
 *                 type: string
 *                 description: Department ID
 *               responseTime:
 *                 type: integer
 *                 description: Waktu respons dalam menit
 *                 example: 60
 *               resolutionTime:
 *                 type: integer
 *                 description: Waktu resolusi dalam menit
 *                 example: 480
 *               businessHoursOnly:
 *                 type: boolean
 *                 default: true
 *                 description: Hanya hitung jam kerja
 *     responses:
 *       201:
 *         description: SLA rule created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/SLA'
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

        return NextResponse.json({
            success: true,
            data: sla,
            message: 'SLA rule created successfully',
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating SLA rule:', error);
        return NextResponse.json({ error: 'Failed to create SLA rule' }, { status: 500 });
    }
}