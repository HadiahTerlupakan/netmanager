/**
 * IP Pool Management API by IP Address
 * DELETE /api/admin/radius/ippool/[ipAddress] - Remove IP from pool
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RadiusRepository } from '@/lib/repositories/RadiusRepository';

interface RouteContext {
    params: Promise<{
        ipAddress: string;
    }>;
}

export async function DELETE(req: NextRequest, context: RouteContext) {
    try {
        // Auth check
        const session = await getServerSession(authConfig);
        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 401 }
            );
        }

        const { ipAddress } = await context.params;

        // Validate IP address format
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(ipAddress)) {
            return NextResponse.json(
                { error: 'Invalid IP address format' },
                { status: 400 }
            );
        }

        const radiusRepo = new RadiusRepository(prisma);
        await radiusRepo.removeFromIpPool(ipAddress);

        return NextResponse.json({
            success: true,
            message: 'IP removed from pool successfully',
            ipAddress,
        });
    } catch (error) {
        console.error('IP Pool delete error:', error);

        // Check if it's a "record not found" error
        if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
            return NextResponse.json(
                { error: 'IP address not found in pool' },
                { status: 404 }
            );
        }

        return NextResponse.json(
            {
                error: 'Failed to remove IP from pool',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}