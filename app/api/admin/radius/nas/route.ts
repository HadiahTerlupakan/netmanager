/**
 * NAS Management API
 * GET /api/admin/radius/nas - List all NAS
 * POST /api/admin/radius/nas - Create new NAS
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RadiusRepository } from '@/modules/network/repositories/RadiusRepository';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response';

export async function GET(_req: NextRequest) {
    try {
        const session = await getServerSession(authConfig);
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        // Permission check
        if (!await hasPermission('radius:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat NAS');
        }

        const radiusRepo = new RadiusRepository(prisma);
        const nasList = await radiusRepo.getAllNas();

        return apiSuccess({ data: nasList, count: nasList.length });
    } catch (error) {
        console.error('NAS list error:', error);
        return ApiErrors.internalError('Gagal mengambil daftar NAS');
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authConfig);
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        // Permission check
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
        try {
            const { logger } = await import('@/lib/logger')
            await logger.logActivity({
                action: 'CREATE',
                subject: 'NAS',
                ...(session.user.id ? { userId: session.user.id } : {}),
                details: { id: newNas.id, nasname: newNas.nasname, shortname: newNas.shortname }
            })
        } catch (e) {
            console.error('Logging failed', e)
        }

        return apiSuccess(newNas, { status: 201, message: 'NAS berhasil dibuat' });
    } catch (error) {
        console.error('NAS creation error:', error);
        return ApiErrors.internalError('Gagal membuat NAS');
    }
}