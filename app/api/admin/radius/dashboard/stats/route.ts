import { prisma } from '@/modules/database';
import { RadiusRepository } from '@/modules/network';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api';

const radiusRepository = new RadiusRepository(prisma);

export const GET = createHandler({ auth: true }, async (_req, ctx) => {
    if (!await hasPermission('radius:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat statistik RADIUS');
    }

    const tenantId = ctx.session!.user.tenantId;
    const stats = await radiusRepository.getDashboardStats(tenantId);
    return apiSuccess(stats);
})
