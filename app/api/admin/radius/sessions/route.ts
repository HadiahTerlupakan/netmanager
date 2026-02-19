import { prisma } from '@/lib/prisma';
import { RadiusRepository } from '@/modules/network/repositories/RadiusRepository';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api';

export const GET = createHandler({ auth: true }, async (req, _ctx) => {
    if (!await hasPermission('radius:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat sesi RADIUS');
    }

    const { searchParams } = req.nextUrl;
    const username = searchParams.get('username') || undefined;

    const radiusRepo = new RadiusRepository(prisma);
    const sessions = await radiusRepo.getActiveSessions(username);

    // Convert BigInt to string for JSON serialization
    const serializedSessions = sessions.map((session) => ({
        ...session,
        radAcctId: session.radAcctId.toString(),
        acctSessionTime: session.acctSessionTime?.toString() || null,
        acctInputOctets: session.acctInputOctets?.toString() || null,
        acctOutputOctets: session.acctOutputOctets?.toString() || null,
    }));

    return apiSuccess({
        count: sessions.length,
        sessions: serializedSessions,
    });
})
