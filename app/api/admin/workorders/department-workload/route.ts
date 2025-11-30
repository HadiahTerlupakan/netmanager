import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { WorkOrderRepository } from '@/lib/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';

const prisma = new PrismaClient();
const workOrderRepo = new WorkOrderRepository(prisma);

// GET /api/admin/workorders/department-workload - Get department workload statistics
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user || user.role === 'USER') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const workload = await workOrderRepo.getDepartmentWorkload();

        return NextResponse.json({
            success: true,
            data: workload,
        });
    } catch (error) {
        console.error('Error fetching department workload:', error);
        return NextResponse.json({ error: 'Failed to fetch department workload' }, { status: 500 });
    }
}
