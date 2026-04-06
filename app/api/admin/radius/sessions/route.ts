import { prisma } from '@/modules/database';
import { RadiusRepository } from '@/modules/network';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api';

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('radius:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat sesi RADIUS');
    }

    const { searchParams } = req.nextUrl;
    const username = searchParams.get('username') || undefined;
    const tenantId = ctx.session!.user.tenantId;

    const radiusRepo = new RadiusRepository(prisma);
    const sessions = await radiusRepo.getActiveSessions(tenantId, username);

    // Convert BigInt to string for JSON serialization
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serializedSessions = sessions.map((session: any) => ({
        ...session,
        radacctid: session.radacctid.toString(),
        acctsessiontime: session.acctsessiontime?.toString() || null,
        acctinputoctets: session.acctinputoctets?.toString() || null,
        acctoutputoctets: session.acctoutputoctets?.toString() || null,
    }));

    return apiSuccess({
        count: sessions.length,
        sessions: serializedSessions,
    });
})
