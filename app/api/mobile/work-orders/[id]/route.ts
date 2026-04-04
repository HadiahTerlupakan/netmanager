import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order';
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api'

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
    const workOrderId = ctx.params.id;
    const repository = new WorkOrderRepository(prisma);

    const workOrder = await repository.findById(workOrderId);

    if (!workOrder) {
        return ApiErrors.notFound('Work Order tidak ditemukan');
    }

    return apiSuccess(workOrder);
});
