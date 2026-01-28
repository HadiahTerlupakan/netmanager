/**
 * RADIUS Recent Sessions API
 * GET /api/admin/radius/dashboard/recent-sessions
 * 
 * Returns recent/active sessions with pagination
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RadiusRepository } from '@/modules/network/repositories/RadiusRepository';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors } from '@/lib/api-response';

const radiusRepository = new RadiusRepository(prisma);

export async function GET(req: NextRequest) {
    try {
        // Auth check
        const session = await getServerSession(authConfig);
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('radius:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat sesi RADIUS');
        }

        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const status = searchParams.get('status') || 'active'; // active | all

        const { sessions, total } = await radiusRepository.getRecentSessions({
            page,
            limit,
            status: status as 'active' | 'all',
        });

        return apiSuccess({
            sessions,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('RADIUS recent sessions error:', error);
        return ApiErrors.internalError('Gagal mengambil sesi terbaru');
    }
}
