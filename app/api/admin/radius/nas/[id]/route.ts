import { prisma } from '@/lib/prisma';
import { RadiusRepository } from '@/modules/network/repositories/RadiusRepository';
import type { INas } from '@/modules/network/repositories/IRadiusRepository';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError, createHandler } from '@/lib/api';

export const GET = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('radius:read')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat NAS');
    }

    const { id: idStr } = ctx.params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
        return apiError('ID NAS tidak valid', ErrorCodes.BAD_REQUEST, { status: 400 });
    }

    const tenantId = ctx.session!.user.tenantId;
    const radiusRepo = new RadiusRepository(prisma);
    const nas = await radiusRepo.getNasById(id, tenantId);

    if (!nas) {
        return ApiErrors.notFound('NAS');
    }

    return apiSuccess(nas);
})

export const PUT = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('radius:update')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah NAS');
    }

    const { id: idStr } = ctx.params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
        return apiError('ID NAS tidak valid', ErrorCodes.BAD_REQUEST, { status: 400 });
    }

    const body = await req.json();
    const { nasname, shortname, type, ports, secret, community, description } = body;

    const tenantId = ctx.session!.user.tenantId;
    const radiusRepo = new RadiusRepository(prisma);

    // Check if NAS exists
    const existingNas = await radiusRepo.getNasById(id, tenantId);
    if (!existingNas) {
        return ApiErrors.notFound('NAS');
    }

    // Check if new nasname conflicts with existing NAS (if changing)
    if (nasname && nasname !== existingNas.nasname) {
        const conflictNas = await radiusRepo.getNasByIp(nasname, tenantId);
        if (conflictNas) {
            return ApiErrors.conflict('NAS dengan IP/hostname ini sudah ada');
        }
    }

    const updateData: Partial<INas> = {};
    if (nasname !== undefined) updateData.nasname = nasname;
    if (shortname !== undefined) updateData.shortname = shortname;
    if (type !== undefined) updateData.type = type;
    if (ports !== undefined) updateData.ports = ports;
    if (secret !== undefined) updateData.secret = secret;
    if (community !== undefined) updateData.community = community;
    if (description !== undefined) updateData.description = description;

    const updatedNas = await radiusRepo.updateNas(id, updateData, tenantId);

    return apiSuccess(updatedNas, { message: 'NAS berhasil diperbarui' });
})

export const DELETE = createHandler({ auth: true }, async (req, ctx) => {
    if (!await hasPermission('radius:delete')) {
        return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus NAS');
    }

    const { id: idStr } = ctx.params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
        return apiError('ID NAS tidak valid', ErrorCodes.BAD_REQUEST, { status: 400 });
    }

    const tenantId = ctx.session!.user.tenantId;
    const radiusRepo = new RadiusRepository(prisma);

    // Check if NAS exists
    const existingNas = await radiusRepo.getNasById(id, tenantId);
    if (!existingNas) {
        return ApiErrors.notFound('NAS');
    }

    await radiusRepo.deleteNas(id, tenantId);

    return apiSuccess(null, { message: 'NAS berhasil dihapus' });
})
