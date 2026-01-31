/**
 * IP Pool Management API
 * GET /api/admin/radius/ippool - List all IP pools
 * GET /api/admin/radius/ippool?stats=true - Get IP pool statistics
 * POST /api/admin/radius/ippool - Add IP to pool
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RadiusRepository } from '@/modules/network/repositories/RadiusRepository';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authConfig);
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('radius:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat IP Pool');
        }

        const { searchParams } = new URL(req.url);
        const getStats = searchParams.get('stats') === 'true';
        const poolName = searchParams.get('poolName');

        const radiusRepo = new RadiusRepository(prisma);

        if (getStats) {
            const stats = await radiusRepo.getIpPoolStats(poolName || undefined);
            return apiSuccess({
                data: stats,
                poolName: poolName || 'all',
            });
        } else {
            const pools = await radiusRepo.getAllIpPools();

            // Filter by pool name if provided
            const filteredPools = poolName
                ? pools.filter(pool => pool.poolName === poolName)
                : pools;

            return apiSuccess({
                data: filteredPools,
                count: filteredPools.length,
                poolName: poolName || 'all',
            });
        }
    } catch (error) {
        console.error('IP Pool list error:', error);
        return ApiErrors.internalError('Gagal mengambil daftar IP Pool');
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authConfig);
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('radius:create')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk menambah IP Pool');
        }

        const body = await req.json();
        const { poolName, framedIpAddress } = body;

        // Validation
        if (!poolName || !framedIpAddress) {
            return apiError('Pool name dan framed IP address wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 });
        }

        // Validate IP address format
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(framedIpAddress)) {
            return apiError('Format alamat IP tidak valid', ErrorCodes.VALIDATION_ERROR, { status: 400 });
        }

        const radiusRepo = new RadiusRepository(prisma);

        const newPool = await radiusRepo.addToIpPool({
            poolName,
            framedIpAddress,
        });

        // System Log
        try {
            const { logger } = await import('@/lib/logger')
            await logger.logActivity({
                action: 'CREATE',
                subject: 'IP Pool',
                ...(session.user.id ? { userId: session.user.id } : {}),
                details: {
                    id: (newPool as unknown as { id: string }).id,
                    poolName: (newPool as { poolName: string }).poolName,
                    ip: (newPool as { framedIpAddress: string }).framedIpAddress
                }
            })
        } catch (e) {
            console.error('Logging failed', e)
        }

        return apiSuccess(newPool, { status: 201, message: 'IP berhasil ditambahkan ke pool' });
    } catch (error) {
        console.error('IP Pool creation error:', error);
        return ApiErrors.internalError('Gagal menambah IP ke pool');
    }
}