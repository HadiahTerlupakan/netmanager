import { prisma } from '@/lib/prisma';
import { RadiusRepository } from '@/modules/network/repositories/RadiusRepository';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api';

const radiusRepository = new RadiusRepository(prisma);

export const GET = createHandler({ auth: true }, async (_req, _ctx) => {
    if (!await hasPermission('radius:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat statistik RADIUS');
    }

    const stats = await radiusRepository.getDashboardStats();
    return apiSuccess(stats);
})
