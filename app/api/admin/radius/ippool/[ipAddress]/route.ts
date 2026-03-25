import { prisma } from '@/lib/prisma';
import { RadiusRepository } from '@/modules/network/repositories/RadiusRepository';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api';

export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('radius:delete')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus IP Pool');
    }

    const { ipAddress } = ctx.params;

    // Validate IP address format
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ipAddress)) {
        return apiError('Format alamat IP tidak valid', ErrorCodes.VALIDATION_ERROR, { status: 400 });
    }

    const tenantId = ctx.session!.user.tenantId;
    const radiusRepo = new RadiusRepository(prisma);
    await radiusRepo.removeFromIpPool(ipAddress, tenantId);

    return apiSuccess({ ipAddress }, { message: 'IP berhasil dihapus dari pool' });
})
