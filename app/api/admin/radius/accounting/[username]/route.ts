import { prisma } from '@/lib/prisma';
import { RadiusSyncService } from '@/modules/network';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api';

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    const { username } = ctx.params
    
    if (!await hasPermission('radius:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat data accounting');
    }

    const { searchParams } = req.nextUrl;

    const startDate = searchParams.get('startDate')
        ? new Date(searchParams.get('startDate')!)
        : undefined;
    const endDate = searchParams.get('endDate')
        ? new Date(searchParams.get('endDate')!)
        : undefined;

    const tenantId = ctx.session!.user.tenantId;
    const syncService = new RadiusSyncService(prisma);
    const stats = await syncService.getCustomerAccountingStats(
        username,
        tenantId,
        startDate,
        endDate
    );

    // Convert BigInt to string for JSON serialization
    const serializedStats = {
        ...stats,
        totalSessionTime: stats.totalSessionTime.toString(),
        totalInputOctets: stats.totalInputOctets.toString(),
        totalOutputOctets: stats.totalOutputOctets.toString(),
        // Add human-readable formats
        totalSessionTimeHours: Number(stats.totalSessionTime) / 3600,
        totalInputGB: Number(stats.totalInputOctets) / 1073741824,
        totalOutputGB: Number(stats.totalOutputOctets) / 1073741824,
    };

    return apiSuccess({
        username,
        period: {
            startDate: startDate?.toISOString() || null,
            endDate: endDate?.toISOString() || null,
        },
        stats: serializedStats,
    });
})
