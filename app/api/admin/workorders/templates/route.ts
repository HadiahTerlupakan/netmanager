import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { workOrderTemplateCreateSchema, workOrderTemplateQuerySchema } from '@/lib/validations/workorder-template';

/**
 * @swagger
 * /api/admin/workorders/templates:
 *   get:
 *     summary: Get all work order templates
 *     description: Mengambil daftar semua template work order dengan filter dan pagination
 *     tags: [Work Order Templates]
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
 *         name: type
 *         schema:
 *           type: string
 *           enum: [INSTALLATION, TROUBLESHOOT, MAINTENANCE, UPGRADE, RELOCATION, DISCONNECTION, OTHER]
 *         description: Filter by type
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
 *         description: List of work order templates
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
 *                     $ref: '#/components/schemas/WorkOrderTemplate'
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

        const where: any = {};

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
            (prisma as any).workOrderTemplate.findMany({
                where,
                include: {
                    department: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    createdBy: {
                        select: {
                            id: true,
                            fullName: true,
                        },
                    },
                },
                orderBy: {
                    [query.sortBy]: query.sortOrder,
                },
                skip: (query.page - 1) * query.limit,
                take: query.limit,
            }),
            (prisma as any).workOrderTemplate.count({ where }),
        ]);

        return NextResponse.json({
            success: true,
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
        return NextResponse.json({ error: 'Failed to fetch work order templates' }, { status: 500 });
    }
}

/**
 * @swagger
 * /api/admin/workorders/templates:
 *   post:
 *     summary: Create new work order template
 *     description: Membuat template work order baru
 *     tags: [Work Order Templates]
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
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *                 example: Template Instalasi Standar
 *               description:
 *                 type: string
 *                 example: Template untuk instalasi fiber optic standar
 *               type:
 *                 type: string
 *                 enum: [INSTALLATION, TROUBLESHOOT, MAINTENANCE, UPGRADE, RELOCATION, DISCONNECTION, OTHER]
 *                 example: INSTALLATION
 *               priority:
 *                 type: string
 *                 enum: [LOW, NORMAL, HIGH, URGENT, CRITICAL]
 *                 default: NORMAL
 *               departmentId:
 *                 type: string
 *                 description: Department ID
 *               estimatedHours:
 *                 type: number
 *                 description: Estimasi waktu pengerjaan dalam jam
 *               estimatedCost:
 *                 type: number
 *                 description: Estimasi biaya
 *               requiredMaterials:
 *                 type: object
 *                 description: Material yang diperlukan (JSON)
 *               tasks:
 *                 type: array
 *                 description: Daftar tugas (JSON)
 *               checklist:
 *                 type: array
 *                 description: Checklist (JSON)
 *     responses:
 *       201:
 *         description: Work order template created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/WorkOrderTemplate'
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
        const validatedData = workOrderTemplateCreateSchema.parse(body);

        // Get employee ID if available
        const employee = await prisma.employee.findUnique({
            where: { userId: user.id },
        });

        const template = await (prisma as any).workOrderTemplate.create({
            data: {
                ...validatedData,
                createdById: employee?.id,
            },
            include: {
                department: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                createdBy: {
                    select: {
                        id: true,
                        fullName: true,
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            data: template,
            message: 'Work order template created successfully',
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating work order template:', error);
        return NextResponse.json({ error: 'Failed to create work order template' }, { status: 500 });
    }
}