/**
 * RADIUS Sync API
 * POST /api/admin/radius/sync - Sync all customers
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RadiusSyncService } from '@/modules/network';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors } from '@/lib/api-response';

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authConfig);
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('radius:update')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk sinkronisasi RADIUS');
        }

        const syncService = new RadiusSyncService(prisma);

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
    } catch (error) {
        console.error('RADIUS sync error:', error);
        return ApiErrors.internalError('Gagal sinkronisasi RADIUS users');
    }
}
