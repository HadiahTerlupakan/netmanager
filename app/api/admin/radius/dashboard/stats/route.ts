/**
 * RADIUS Dashboard Statistics API
 * GET /api/admin/radius/dashboard/stats
 * 
 * Returns overall statistics for the dashboard
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RadiusRepository } from '@/modules/network/repositories/RadiusRepository';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors } from '@/lib/api-response';

const radiusRepository = new RadiusRepository(prisma);

export async function GET(_req: NextRequest) {
    try {
        const session = await getServerSession(authConfig);
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('radius:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat statistik RADIUS');
        }

        const stats = await radiusRepository.getDashboardStats();
        return apiSuccess(stats);
    } catch (error) {
        console.error('RADIUS dashboard stats error:', error);
        return ApiErrors.internalError('Gagal mengambil statistik dashboard');
    }
}
