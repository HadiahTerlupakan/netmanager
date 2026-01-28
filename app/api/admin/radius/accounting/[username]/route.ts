/**
 * RADIUS Accounting API
 * GET /api/admin/radius/accounting/[username] - Get usage statistics for user
 */

import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RadiusSyncService } from '@/modules/network';
import { hasPermission } from '@/lib/rbac';
import { apiSuccess, ApiErrors } from '@/lib/api-response';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await params
        
        // Auth check
        const session = await getServerSession(authConfig);
        if (!session?.user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('radius:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat data accounting');
        }

        const { searchParams } = new URL(req.url);

        const startDate = searchParams.get('startDate')
            ? new Date(searchParams.get('startDate')!)
            : undefined;
        const endDate = searchParams.get('endDate')
            ? new Date(searchParams.get('endDate')!)
            : undefined;

        const syncService = new RadiusSyncService(prisma);
        const stats = await syncService.getCustomerAccountingStats(
            username,
            startDate,
            endDate
        );

        // Convert BigInt to string for JSON serialization
        const serializedStats = {
            ...stats,
            totalSessionTime: stats.totalSessionTime.toString(),
            totalInputOctets: stats.totalInputOctets.toString(),
            totalOutputOctets: stats.totalOutputOctets.toString(),
            // Add human-readable formats
            totalSessionTimeHours: Number(stats.totalSessionTime) / 3600,
            totalInputGB: Number(stats.totalInputOctets) / 1073741824,
            totalOutputGB: Number(stats.totalOutputOctets) / 1073741824,
        };

        return apiSuccess({
            username,
            period: {
                startDate: startDate?.toISOString() || null,
                endDate: endDate?.toISOString() || null,
            },
            stats: serializedStats,
        });
    } catch (error) {
        console.error('RADIUS accounting error:', error);
        return ApiErrors.internalError('Gagal mengambil data accounting');
    }
}
