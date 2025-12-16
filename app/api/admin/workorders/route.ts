import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/lib/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';
import { onWorkOrderCreated } from '@/lib/services/WorkOrderNotifications';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const workOrderRepo = new WorkOrderRepository(prisma);

/**
 * @swagger
 * /api/admin/workorders:
 *   get:
 *     summary: Get all work orders
 *     description: Mengambil daftar semua work order dengan filter dan pagination
 *     tags: [Work Orders]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, IN_PROGRESS, COMPLETED, CANCELLED]
 *         description: Filter by status (comma-separated for multiple)
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, URGENT]
 *         description: Filter by priority
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [INSTALLATION, MAINTENANCE, TROUBLESHOOTING, RELOCATION]
 *         description: Filter by type
 *       - in: query
 *         name: departmentId
 *         schema:
 *           type: string
 *         description: Filter by department
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title and description
 *     responses:
 *       200:
 *         description: List of work orders
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
 *                     $ref: '#/components/schemas/WorkOrder'
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
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const status = searchParams.get('status');
        const priority = searchParams.get('priority');
        const type = searchParams.get('type');
        const departmentId = searchParams.get('departmentId');
        const assignedToId = searchParams.get('assignedToId');
        const search = searchParams.get('search');
        const unassignedOnly = searchParams.get('unassignedOnly') === 'true';

        const filters: any = {};
        if (status) filters.status = status.includes(',') ? status.split(',') : status;
        if (priority) filters.priority = priority.includes(',') ? priority.split(',') : priority;
        if (type) filters.type = type.includes(',') ? type.split(',') : type;
        if (departmentId) filters.departmentId = departmentId;
        if (assignedToId) filters.assignedToId = assignedToId;
        if (search) filters.search = search;
        if (unassignedOnly) filters.unassignedOnly = true;

        const result = await workOrderRepo.findAll(filters, page, limit);

        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error('Error fetching work orders:', error);
        return NextResponse.json({ error: 'Failed to fetch work orders' }, { status: 500 });
    }
}

/**
 * @swagger
 * /api/admin/workorders:
 *   post:
 *     summary: Create new work order
 *     description: Membuat work order baru dan mengirim notifikasi ke department terkait
 *     tags: [Work Orders]
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
 *               - type
 *               - title
 *               - description
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [INSTALLATION, MAINTENANCE, TROUBLESHOOTING, RELOCATION]
 *                 example: INSTALLATION
 *               title:
 *                 type: string
 *                 example: Instalasi baru pelanggan
 *               description:
 *                 type: string
 *                 example: Instalasi fiber optic untuk pelanggan baru
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *                 default: MEDIUM
 *               pelangganId:
 *                 type: string
 *                 description: ID pelanggan terkait
 *               departmentId:
 *                 type: string
 *                 description: Department yang akan menangani
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *                 description: Tanggal jadwal pengerjaan
 *     responses:
 *       201:
 *         description: Work order created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/WorkOrder'
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

        if (!body.type || !body.title || !body.description) {
            return NextResponse.json(
                { error: 'Type, title, and description are required' },
                { status: 400 }
            );
        }

        // Include ticketId in Work Order data
        const { ticketId, ...restBody } = body;

        // Pass everything to repo including ticketId (now supported by type and schema)
        const workOrderData = {
            ...restBody,
            ticketId: ticketId
        };

        const workOrder = await workOrderRepo.create({
            ...workOrderData,
            createdById: user.id,
        });

        // Trigger notification for new Work Order
        // This notifies all users in the department
        await onWorkOrderCreated({
            id: workOrder.id,
            workOrderNumber: workOrder.workOrderNumber,
            title: workOrder.title,
            type: workOrder.type,
            priority: workOrder.priority,
            departmentId: workOrder.departmentId,
            assignedToId: workOrder.assignedToId,
        });

        // Link to Ticket and Auto-Reply if ticketId is present
        if (ticketId) {
            try {
                const scheduledTime = workOrder.scheduledDate
                    ? format(new Date(workOrder.scheduledDate), 'dd MMMM yyyy HH:mm', { locale: id })
                    : 'Belum Dijadwalkan';

                const replyMessage = `Work Order #${workOrder.workOrderNumber} telah dibuat untuk tiket ini.\n\n` +
                    `Judul: ${workOrder.title}\n` +
                    `Tipe: ${workOrder.type}\n` +
                    `Jadwal: ${scheduledTime}`;

                await prisma.ticketReply.create({
                    data: {
                        ticketId: ticketId,
                        message: replyMessage,
                        isFromAdmin: true,
                        senderId: user.id, // Support Admin who created the WO
                    }
                });

                // Update Ticket Status to IN_PROGRESS
                await prisma.supportTicket.update({
                    where: { id: ticketId },
                    data: {
                        status: 'IN_PROGRESS',
                        // Optional: Assign ticket to WO creator if assignedToId is not strict
                    }
                });

                console.log(`Auto-replied to ticket ${ticketId} for Work Order ${workOrder.workOrderNumber}`);
            } catch (ticketError) {
                console.error('Error sending auto-reply to ticket:', ticketError);
                // Non-blocking error
            }
        }

        return NextResponse.json({
            success: true,
            data: workOrder,
            message: 'Work order created successfully',
        }, { status: 201 });
    } catch (error) {
        console.error('Error creating work order:', error);
        return NextResponse.json({ error: 'Failed to create work order' }, { status: 500 });
    }
}
