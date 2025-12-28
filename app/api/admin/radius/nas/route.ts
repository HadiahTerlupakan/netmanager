/**
 * NAS Management API
 * GET /api/admin/radius/nas - List all NAS
 * POST /api/admin/radius/nas - Create new NAS
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RadiusRepository } from '@/modules/network/repositories/RadiusRepository';
import type { INas } from '@/modules/network/repositories/IRadiusRepository';
import { hasPermission } from '@/lib/rbac';

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authConfig);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Permission check
        if (!await hasPermission('radius:read')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const radiusRepo = new RadiusRepository(prisma);
        const nasList = await radiusRepo.getAllNas();

        return NextResponse.json({
            success: true,
            data: nasList,
            count: nasList.length,
        });
    } catch (error) {
        console.error('NAS list error:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch NAS list',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authConfig);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Permission check
        if (!await hasPermission('radius:create')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const { nasname, shortname, type, ports, secret, community, description } = body;

        // Validation
        if (!nasname || !secret) {
            return NextResponse.json(
                { error: 'NAS name and secret are required' },
                { status: 400 }
            );
        }

        const radiusRepo = new RadiusRepository(prisma);

        // Check if NAS already exists
        const existingNas = await radiusRepo.getNasByIp(nasname);
        if (existingNas) {
            return NextResponse.json(
                { error: 'NAS with this IP/hostname already exists' },
                { status: 409 }
            );
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
                userId: session.user.id,
                details: { id: newNas.id, nasname: newNas.nasname, shortname: newNas.shortname }
            })
        } catch (e) {
            console.error('Logging failed', e)
        }

        return NextResponse.json({
            success: true,
            message: 'NAS created successfully',
            data: newNas,
        });
    } catch (error) {
        console.error('NAS creation error:', error);
        return NextResponse.json(
            {
                error: 'Failed to create NAS',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}