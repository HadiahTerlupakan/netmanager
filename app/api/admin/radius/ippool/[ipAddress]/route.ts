/**
 * IP Pool Management API by IP Address
 * DELETE /api/admin/radius/ippool/[ipAddress] - Remove IP from pool
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RadiusRepository } from '@/modules/network/repositories/RadiusRepository';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response';

interface RouteContext {
    params: Promise<{
        ipAddress: string;
    }>;
}

export async function DELETE(req: NextRequest, context: RouteContext) {
    try {
        // Auth check
        const session = await getServerSession(authConfig);
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('radius:delete')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk menghapus IP Pool');
        }

        const { ipAddress } = await context.params;

        // Validate IP address format
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(ipAddress)) {
            return apiError('Format alamat IP tidak valid', ErrorCodes.VALIDATION_ERROR, { status: 400 });
        }

        const radiusRepo = new RadiusRepository(prisma);
        await radiusRepo.removeFromIpPool(ipAddress);

        return apiSuccess({ ipAddress }, { message: 'IP berhasil dihapus dari pool' });
    } catch (error) {
        console.error('IP Pool delete error:', error);

        // Check if it's a "record not found" error
        if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
            return ApiErrors.notFound('IP address dalam pool');
        }

        return ApiErrors.internalError('Gagal menghapus IP dari pool');
    }
}