import { prisma } from '@/modules/database';
import { RadiusRepository } from '@/modules/network';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api';
import { logActivitySafe } from '@/lib/logger';

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('radius:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat IP Pool');
    }

    const { searchParams } = req.nextUrl;
    const getStats = searchParams.get('stats') === 'true';
    const poolName = searchParams.get('poolName');

    const tenantId = ctx.session!.user.tenantId;
    const radiusRepo = new RadiusRepository(prisma);

    if (getStats) {
        const stats = await radiusRepo.getIpPoolStats(tenantId, poolName || undefined);
        return apiSuccess({
            data: stats,
            poolName: poolName || 'all',
        });
    } else {
        const pools = await radiusRepo.getAllIpPools(tenantId);

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
})

export const POST = createHandler({ auth: true }, async (req, ctx) => {
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

    const tenantId = ctx.session!.user.tenantId;
    const radiusRepo = new RadiusRepository(prisma);

    const newPool = await radiusRepo.addToIpPool({
        poolName,
        framedIpAddress,
    }, tenantId);

    // System Log
    logActivitySafe({
        action: 'CREATE',
        subject: 'IP Pool',
        userId: ctx.session!.user.id,
        details: {
            id: (newPool as unknown as { id: string }).id,
            poolName: (newPool as { poolName: string }).poolName,
            ip: (newPool as { framedIpAddress: string }).framedIpAddress
        }
    })

    return apiSuccess(newPool, { status: 201, message: 'IP berhasil ditambahkan ke pool' });
})
