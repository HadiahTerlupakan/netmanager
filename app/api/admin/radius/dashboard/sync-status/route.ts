/**
 * RADIUS Sync Status API
 * GET /api/admin/radius/dashboard/sync-status
 * 
 * Returns last sync status (placeholder for now)
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors } from '@/lib/api-response';

export async function GET(_req: NextRequest) {
    try {
        // Auth check
        const session = await getServerSession(authConfig);
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

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
    } catch (error) {
        console.error('RADIUS sync status error:', error);
        return ApiErrors.internalError('Gagal mengambil status sinkronisasi');
    }
}
