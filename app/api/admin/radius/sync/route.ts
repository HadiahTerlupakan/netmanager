import { RadiusSyncService } from '@/modules/network';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api';

export const POST = createHandler({ auth: true }, async (_req, _ctx) => {
    if (!await hasPermission('radius:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk sinkronisasi RADIUS');
    }

    const syncService = new RadiusSyncService();

    // Sync all active customers
    const result = await syncService.syncAllActiveCustomers();

    return apiSuccess({
        stats: {
            created: result.created,
            updated: result.updated,
            deleted: result.deleted,
            total: result.created + result.updated + result.deleted,
        }
    }, { message: 'Sinkronisasi RADIUS selesai' });
})
