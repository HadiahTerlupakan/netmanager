/**
 * RADIUS Accounting API
 * GET /api/admin/radius/accounting/[username] - Get usage statistics for user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RadiusSyncService } from '@/lib/services/radius-sync-service';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ username: string }> }
) {
    try {
        const { username } = await params
        // Auth check
        const session = await getServerSession(authConfig);
        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 401 }
            );
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

        return NextResponse.json({
            success: true,
            username,
            period: {
                startDate: startDate?.toISOString() || null,
                endDate: endDate?.toISOString() || null,
            },
            stats: serializedStats,
        });
    } catch (error) {
        console.error('RADIUS accounting error:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch accounting data',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
