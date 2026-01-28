/**
 * NAS Management API by ID
 * GET /api/admin/radius/nas/[id] - Get NAS by ID
 * PUT /api/admin/radius/nas/[id] - Update NAS
 * DELETE /api/admin/radius/nas/[id] - Delete NAS
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RadiusRepository } from '@/modules/network/repositories/RadiusRepository';
import type { INas } from '@/modules/network/repositories/IRadiusRepository';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response';

interface RouteContext {
    params: Promise<{
        id: string;
    }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
    try {
        const session = await getServerSession(authConfig);
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('radius:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat NAS');
        }

        const { id: idStr } = await context.params;
        const id = parseInt(idStr);
        if (isNaN(id)) {
            return apiError('ID NAS tidak valid', ErrorCodes.BAD_REQUEST, { status: 400 });
        }

        const radiusRepo = new RadiusRepository(prisma);
        const nas = await radiusRepo.getNasById(id);

        if (!nas) {
            return ApiErrors.notFound('NAS');
        }

        return apiSuccess(nas);
    } catch (error) {
        console.error('NAS get error:', error);
        return ApiErrors.internalError('Gagal mengambil data NAS');
    }
}

export async function PUT(req: NextRequest, context: RouteContext) {
    try {
        const session = await getServerSession(authConfig);
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('radius:update')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk mengubah NAS');
        }

        const { id: idStr } = await context.params;
        const id = parseInt(idStr);
        if (isNaN(id)) {
            return apiError('ID NAS tidak valid', ErrorCodes.BAD_REQUEST, { status: 400 });
        }

        const body = await req.json();
        const { nasname, shortname, type, ports, secret, community, description } = body;

        const radiusRepo = new RadiusRepository(prisma);

        // Check if NAS exists
        const existingNas = await radiusRepo.getNasById(id);
        if (!existingNas) {
            return ApiErrors.notFound('NAS');
        }

        // Check if new nasname conflicts with existing NAS (if changing)
        if (nasname && nasname !== existingNas.nasname) {
            const conflictNas = await radiusRepo.getNasByIp(nasname);
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

        const updatedNas = await radiusRepo.updateNas(id, updateData);

        return apiSuccess(updatedNas, { message: 'NAS berhasil diperbarui' });
    } catch (error) {
        console.error('NAS update error:', error);
        return ApiErrors.internalError('Gagal memperbarui NAS');
    }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
    try {
        const session = await getServerSession(authConfig);
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('radius:delete')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus NAS');
        }

        const { id: idStr } = await context.params;
        const id = parseInt(idStr);
        if (isNaN(id)) {
            return apiError('ID NAS tidak valid', ErrorCodes.BAD_REQUEST, { status: 400 });
        }

        const radiusRepo = new RadiusRepository(prisma);

        // Check if NAS exists
        const existingNas = await radiusRepo.getNasById(id);
        if (!existingNas) {
            return ApiErrors.notFound('NAS');
        }

        await radiusRepo.deleteNas(id);

        return apiSuccess(null, { message: 'NAS berhasil dihapus' });
    } catch (error) {
        console.error('NAS delete error:', error);
        return ApiErrors.internalError('Gagal menghapus NAS');
    }
}