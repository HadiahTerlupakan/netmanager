import { NextRequest, NextResponse } from 'next/server';
import { getMobileAuthPayload } from '@/lib/mobile-api-auth';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    try {
        // 1. Auth Check
        const authResult = await getMobileAuthPayload(request);
        if (authResult instanceof NextResponse) {
            return authResult;
        }

        const workOrderId = params.id;
        const repository = new WorkOrderRepository(prisma);

        // 2. Fetch Data
        const workOrder = await repository.findById(workOrderId);

        if (!workOrder) {
            return NextResponse.json({ error: 'Work Order tidak ditemukan' }, { status: 404 });
        }

        // 3. Return Data
        return NextResponse.json({
            success: true,
            data: workOrder
        });

    } catch (error) {
        console.error('Mobile Work Order Detail Error:', error);
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
    }
}
