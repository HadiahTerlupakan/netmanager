import { prisma } from '@/modules/database';
import { RadiusRepository } from '@/modules/network';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api';

const radiusRepository = new RadiusRepository(prisma);

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('radius:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat sesi RADIUS');
    }

    const tenantId = ctx.session!.user.tenantId;
    const { searchParams } = req.nextUrl;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status') || 'active'; // active | all

    const { sessions, total } = await radiusRepository.getRecentSessions(tenantId, {
        page,
        limit,
        status: status as 'active' | 'all',
    });

    const usernames = sessions
        .map((session) => session.username)
        .filter((username): username is string => Boolean(username));

    const totalUsageByUsername = await radiusRepository.getTotalUsageByUsernames(tenantId, usernames);

    const sessionsWithTotalUsage = sessions.map((session) => {
        if (!session.username) return session;
        const totalUsage = totalUsageByUsername[session.username];
        if (!totalUsage) return session;

        return {
            ...session,
            downloadMB: totalUsage.downloadMB,
            uploadMB: totalUsage.uploadMB,
        };
    });

    return apiSuccess({
        sessions: sessionsWithTotalUsage,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    });
})
