import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { WorkOrderRepository } from '@/lib/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';

const prisma = new PrismaClient();
const workOrderRepo = new WorkOrderRepository(prisma);

// GET /api/admin/workorders/recent - Get recent work orders
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user || user.role === 'USER') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '5');

        const workOrders = await workOrderRepo.getRecentWorkOrders(limit);

        return NextResponse.json({
            success: true,
            data: workOrders,
        });
    } catch (error) {
        console.error('Error fetching recent work orders:', error);
        return NextResponse.json({ error: 'Failed to fetch recent work orders' }, { status: 500 });
    }
}
