import { prisma } from '@/modules/database';
import { WorkOrderRepository } from '@/modules/work-order';
import { WorkOrderStatus } from '@prisma/client';
import { createHandler, apiPaginated } from '@/lib/api'

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const userId = ctx.session!.user.id;
    const searchParams = req.nextUrl.searchParams;
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
    return apiPaginated(result.workOrders, {
        page: result.page,
        total: result.total,
        limit: limit
    });
});
