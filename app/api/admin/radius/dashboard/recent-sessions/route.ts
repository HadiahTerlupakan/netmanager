import { prisma } from '@/modules/database';
import { RadiusRepository, RadiusSyncService } from '@/modules/network';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api';

const ENRICH_CONCURRENCY = 5;

async function enrichUsageFromLiveSessions(
    sessions: Array<{ username: string | null; nasIpAddress: string; isOnline: boolean; downloadMB: number; uploadMB: number }>,
    tenantId: string,
): Promise<void> {
    const syncService = new RadiusSyncService();
    const indexes = sessions
        .map((session, index) => ({ session, index }))
        .filter(({ session }) => {
            if (!session.isOnline || !session.username) return false;
            return session.downloadMB <= 0 && session.uploadMB <= 0;
        });

    for (let i = 0; i < indexes.length; i += ENRICH_CONCURRENCY) {
        const chunk = indexes.slice(i, i + ENRICH_CONCURRENCY);
        await Promise.all(
            chunk.map(async ({ session }) => {
                try {
                    const liveUsage = await syncService.getLiveSessionUsageByUsername(session.username!, tenantId, session.nasIpAddress);
                    if (liveUsage.success) {
                        if (typeof liveUsage.downloadMB === 'number') {
                            session.downloadMB = liveUsage.downloadMB;
                        }
                        if (typeof liveUsage.uploadMB === 'number') {
                            session.uploadMB = liveUsage.uploadMB;
                        }
                    }
                } catch (error) {
                    console.warn('[RADIUS] Failed live usage enrichment:', error);
                }
            })
        );
    }
}

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

    await enrichUsageFromLiveSessions(sessions, tenantId);

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
