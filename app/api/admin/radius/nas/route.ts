import { prisma } from '@/lib/prisma';
import { RadiusRepository } from '@/modules/network/repositories/RadiusRepository';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api';
import { logActivitySafe } from '@/lib/logger';

export const GET = createHandler({ auth: true }, async (_req, _ctx) => {
    if (!await hasPermission('radius:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat NAS');
    }

    const radiusRepo = new RadiusRepository(prisma);
    const nasList = await radiusRepo.getAllNas();

    return apiSuccess({ data: nasList, count: nasList.length });
})

export const POST = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('radius:create')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk membuat NAS');
    }

    const body = await req.json();
    const { nasname, shortname, type, ports, secret, community, description } = body;

    // Validation
    if (!nasname || !secret) {
        return apiError(
            'NAS name dan secret wajib diisi',
            ErrorCodes.VALIDATION_ERROR,
            { status: 400 }
        );
    }

    const radiusRepo = new RadiusRepository(prisma);

    // Check if NAS already exists
    const existingNas = await radiusRepo.getNasByIp(nasname);
    if (existingNas) {
        return ApiErrors.conflict('NAS dengan IP/hostname ini sudah ada');
    }

    const newNas = await radiusRepo.createNas({
        nasname,
        shortname,
        type: type || 'other',
        ports,
        secret,
        community,
        description,
    });

    // System Log
    logActivitySafe({
        action: 'CREATE',
        subject: 'NAS',
        userId: ctx.session!.user.id,
        details: { id: newNas.id, nasname: newNas.nasname, shortname: newNas.shortname }
    })

    return apiSuccess(newNas, { status: 201, message: 'NAS berhasil dibuat' });
})
