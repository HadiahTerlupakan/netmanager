import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { workOrderEscalationCreateSchema, workOrderEscalationQuerySchema } from '@/lib/validations/workorder-escalation';

/**
 * @swagger
 * /api/admin/workorders/escalations:
 *   get:
 *     summary: Get all escalation rules
 *     description: Mengambil daftar semua aturan eskalasi dengan filter dan pagination
 *     tags: [Escalation Rules]
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
 *         name: slaId
 *         schema:
 *           type: string
 *         description: Filter by SLA ID
 *       - in: query
 *         name: escalationLevel
 *         schema:
 *           type: integer
 *         description: Filter by escalation level
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of escalation rules
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
 *                     $ref: '#/components/schemas/WorkOrderEscalation'
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

        const where: any = {};

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
            (prisma as any).workOrderEscalation.findMany({
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
                    department: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    createdBy: {
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
            (prisma as any).workOrderEscalation.count({ where }),
        ]);

        return NextResponse.json({
            success: true,
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
        return NextResponse.json({ error: 'Failed to fetch escalation rules' }, { status: 500 });
    }
}

/**
 * @swagger
 * /api/admin/workorders/escalations:
 *   post:
 *     summary: Create new escalation rule
 *     description: Membuat aturan eskalasi baru
 *     tags: [Escalation Rules]
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
 *               - triggerCondition
 *             properties:
 *               name:
 *                 type: string
 *                 example: Eskalasi ke Manajer
 *               description:
 *                 type: string
 *                 example: Eskalasi ke manajer jika melebihi SLA
 *               slaId:
 *                 type: string
 *                 description: SLA ID
 *               workOrderType:
 *                 type: string
 *                 enum: [INSTALLATION, TROUBLESHOOT, MAINTENANCE, UPGRADE, RELOCATION, DISCONNECTION, OTHER]
 *               priority:
 *                 type: string
 *                 enum: [LOW, NORMAL, HIGH, URGENT, CRITICAL]
 *               departmentId:
 *                 type: string
 *                 description: Department ID
 *               triggerCondition:
 *                 type: string
 *                 description: JSON condition for triggering escalation
 *                 example: '{"status": "OVERDUE", "hoursOverdue": 24}'
 *               escalationLevel:
 *                 type: integer
 *                 default: 1
 *                 description: Escalation level (1-10)
 *               notifyRole:
 *                 type: string
 *                 description: Role to notify
 *               notifyEmployees:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of employee IDs to notify
 *               notifyDepartments:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of department IDs to notify
 *               delayMinutes:
 *                 type: integer
 *                 default: 0
 *                 description: Delay before triggering escalation in minutes
 *     responses:
 *       201:
 *         description: Escalation rule created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/WorkOrderEscalation'
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
        const validatedData = workOrderEscalationCreateSchema.parse(body);

        const escalation = await (prisma as any).workOrderEscalation.create({
            data: {
                ...validatedData,
                createdById: user.id,
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
                department: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        return NextResponse.json({
            success: true,
            data: escalation,
            message: 'Escalation rule created successfully',
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating escalation rule:', error);
        return NextResponse.json({ error: 'Failed to create escalation rule' }, { status: 500 });
    }
}