/**
 * IP Pool Management API
 * GET /api/admin/radius/ippool - List all IP pools
 * GET /api/admin/radius/ippool?stats=true - Get IP pool statistics
 * POST /api/admin/radius/ippool - Add IP to pool
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RadiusRepository } from '@/modules/network/repositories/RadiusRepository';
import type { IRadIpPool } from '@/modules/network/repositories/IRadiusRepository';

export async function GET(req: NextRequest) {
    try {
        // Auth check
        const session = await getServerSession(authConfig);
        if (!session?.user || false) {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(req.url);
        const getStats = searchParams.get('stats') === 'true';
        const poolName = searchParams.get('poolName');

        const radiusRepo = new RadiusRepository(prisma);

        if (getStats) {
            const stats = await radiusRepo.getIpPoolStats(poolName || undefined);
            return NextResponse.json({
                success: true,
                data: stats,
                poolName: poolName || 'all',
            });
        } else {
            const pools = await radiusRepo.getAllIpPools();

            // Filter by pool name if provided
            const filteredPools = poolName
                ? pools.filter(pool => pool.poolName === poolName)
                : pools;

            return NextResponse.json({
                success: true,
                data: filteredPools,
                count: filteredPools.length,
                poolName: poolName || 'all',
            });
        }
    } catch (error) {
        console.error('IP Pool list error:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch IP pools',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        // Auth check
        const session = await getServerSession(authConfig);
        if (!session?.user || false) {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 401 }
            );
        }

        const body = await req.json();
        const { poolName, framedIpAddress, nasIpAddress, poolKey } = body;

        // Validation
        if (!poolName || !framedIpAddress) {
            return NextResponse.json(
                { error: 'Pool name and framed IP address are required' },
                { status: 400 }
            );
        }

        // Validate IP address format
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(framedIpAddress)) {
            return NextResponse.json(
                { error: 'Invalid IP address format' },
                { status: 400 }
            );
        }

        const radiusRepo = new RadiusRepository(prisma);

        const ipPoolData: IRadIpPool = {
            poolName,
            framedIpAddress,
            nasIpAddress,
            poolKey,
        };

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
                userId: session.user.id,
                details: { id: (newPool as any).id, poolName: (newPool as any).poolName, ip: (newPool as any).framedIpAddress }
            })
        } catch (e) {
            console.error('Logging failed', e)
        }

        return NextResponse.json({
            success: true,
            data: newPool,
            message: 'IP added to pool successfully',
        });
    } catch (error) {
        console.error('IP Pool creation error:', error);
        return NextResponse.json(
            {
                error: 'Failed to add IP to pool',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}