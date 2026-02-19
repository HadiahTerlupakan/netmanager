import { prisma } from '@/lib/prisma';
import { RadiusRepository } from '@/modules/network/repositories/RadiusRepository';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api';

const radiusRepository = new RadiusRepository(prisma);

export const GET = createHandler({ auth: true }, async (req, _ctx) => {
    if (!await hasPermission('radius:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat sesi RADIUS');
    }

    const { searchParams } = req.nextUrl;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status') || 'active'; // active | all

    const { sessions, total } = await radiusRepository.getRecentSessions({
        page,
        limit,
        status: status as 'active' | 'all',
    });

    return apiSuccess({
        sessions,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    });
})
