import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/lib/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';

const prisma = new PrismaClient();
const workOrderRepo = new WorkOrderRepository(prisma);

// GET /api/employee/workorders - Get work orders for employee's department
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get employee from user
        const employee = await prisma.employee.findUnique({
            where: { userId: user.id },
            include: {
                department: true,
            },
        });

        if (!employee) {
            return NextResponse.json(
                { error: 'Employee profile not found' },
                { status: 404 }
            );
        }

        if (!employee.departmentId) {
            return NextResponse.json(
                { error: 'Employee not assigned to any department' },
                { status: 400 }
            );
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const search = searchParams.get('search');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');

        const filters: any = {};
        if (status) filters.status = status;
        if (search) filters.search = search;

        const result = await workOrderRepo.getEmployeeDepartmentWorkOrders(
            employee.departmentId,
            employee.id,
            filters,
            page,
            limit
        );

        return NextResponse.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('Error fetching employee work orders:', error);
        return NextResponse.json(
            { error: 'Failed to fetch work orders' },
            { status: 500 }
        );
    }
}
