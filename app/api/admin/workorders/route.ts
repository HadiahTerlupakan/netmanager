import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/lib/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';
import { onWorkOrderCreated } from '@/lib/services/WorkOrderNotifications';

const workOrderRepo = new WorkOrderRepository(prisma);

// GET /api/admin/workorders - List work orders
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

// POST /api/admin/workorders - Create work order
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

        // Get employee ID if available
        const employee = await prisma.employee.findUnique({
            where: { userId: user.id },
        });

        const workOrder = await workOrderRepo.create({
            ...body,
            createdById: employee?.id,
        });

        // Trigger notification for new Work Order
        // This notifies all employees in the department
        await onWorkOrderCreated({
            id: workOrder.id,
            workOrderNumber: workOrder.workOrderNumber,
            title: workOrder.title,
            type: workOrder.type,
            priority: workOrder.priority,
            departmentId: workOrder.departmentId,
            assignedToId: workOrder.assignedToId,
        });

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

