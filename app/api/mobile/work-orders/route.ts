import { NextRequest, NextResponse } from 'next/server';
import { getMobileAuthPayload } from '@/lib/mobile-api-auth';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { WorkOrderStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
    try {
        const authResult = await getMobileAuthPayload(request);
        if (authResult instanceof NextResponse) {
            return authResult;
        }

        const payload = authResult;

        const userId = payload.id as string;
        const searchParams = request.nextUrl.searchParams;
        const type = searchParams.get('type') || 'active'; // 'active' | 'history'
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');

        const repository = new WorkOrderRepository(prisma);

        // 2. Determine Status Filters
        let statusFilters: WorkOrderStatus[] = [];
        if (type === 'active') {
            statusFilters = ['ASSIGNED', 'IN_PROGRESS', 'PENDING', 'ON_HOLD'];
        } else {
            statusFilters = ['COMPLETED', 'VERIFIED', 'CLOSED', 'CANCELLED'];
        }

        // 3. Fetch Data - Use optimized findAllForList() for mobile list view
        const result = await repository.findAllForList(
            {
                involvedUserId: userId, // Lead OR Partner
                status: statusFilters
            },
            page,
            limit
        );

        // 4. Return Data
        // console.log('[Mobile WO API] userId:', userId, 'type:', type, 'count:', result.workOrders.length);
        return NextResponse.json({
            success: true,
            data: result.workOrders,
            meta: {
                page: result.page,
                total: result.total,
                totalPages: result.totalPages
            }
        });

    } catch (error) {
        console.error('Mobile Work Order List Error:', error);
        return NextResponse.json({ error: 'Terjadi kesalahan server' }, { status: 500 });
    }
}
