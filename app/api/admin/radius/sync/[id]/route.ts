import { RadiusSyncService } from '@/modules/network';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, createHandler } from '@/lib/api';

export const POST = createHandler({ auth: true }, async (req, ctx) => {
    const { id } = ctx.params
    
    if (!await hasPermission('radius:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk sinkronisasi RADIUS');
    }

    const syncService = new RadiusSyncService();

    // Sync single customer
    await syncService.syncSingleCustomer(id);

    // Verify sync
    const verification = await syncService.verifyCustomerSync(id);

    return apiSuccess(verification, { message: 'Customer berhasil disinkronisasi ke RADIUS' });
})
