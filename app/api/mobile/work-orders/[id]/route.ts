import { NextRequest, NextResponse } from 'next/server';
import { getMobileAuthPayload } from '@/lib/mobile-api-auth';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { apiError, ErrorCodes } from '@/lib/api-response'

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
            return apiError('Work Order tidak ditemukan', ErrorCodes.NOT_FOUND, { status: 404 });
        }

        // 3. Return Data
        return NextResponse.json({
            success: true,
            data: workOrder
        });

    } catch (error) {
        console.error('Mobile Work Order Detail Error:', error);
        return apiError('Terjadi kesalahan server', ErrorCodes.INTERNAL_ERROR, { status: 500 });
    }
}
