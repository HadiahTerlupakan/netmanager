import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api';

export const GET = createHandler({ auth: true }, async (_req, _ctx) => {
    if (!await hasPermission('radius:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat status sinkronisasi');
    }

    // TODO: Implement actual sync status tracking
    // For now, return placeholder data
    return apiSuccess({
        lastSync: {
            time: new Date().toISOString(),
            success: true,
            stats: {
                created: 0,
                updated: 0,
                deleted: 0,
            },
        },
        isRunning: false,
    });
})
