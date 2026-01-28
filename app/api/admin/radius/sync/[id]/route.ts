/**
 * RADIUS Single Customer Sync API
 * POST /api/admin/radius/sync/[id] - Sync specific customer
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RadiusSyncService } from '@/modules/network';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors } from '@/lib/api-response';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        
        // Auth check
        const session = await getServerSession(authConfig);
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('radius:update')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk sinkronisasi RADIUS');
        }

        const syncService = new RadiusSyncService(prisma);

        // Sync single customer
        await syncService.syncSingleCustomer(id);

        // Verify sync
        const verification = await syncService.verifyCustomerSync(id);

        return apiSuccess(verification, { message: 'Customer berhasil disinkronisasi ke RADIUS' });
    } catch (error) {
        console.error('RADIUS sync error:', error);
        return ApiErrors.internalError('Gagal sinkronisasi customer');
    }
}
