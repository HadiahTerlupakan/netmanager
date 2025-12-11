/**
 * NAS Management API
 * GET /api/admin/radius/nas - List all NAS
 * POST /api/admin/radius/nas - Create new NAS
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RadiusRepository } from '@/lib/repositories/RadiusRepository';
import type { INas } from '@/lib/repositories/IRadiusRepository';

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
        // Auth check
        const session = await getServerSession(authConfig);
        if (!session?.user || false) {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 401 }
            );
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

        const nasData: INas = {
            nasname,
            shortname,
            type: type || 'other',
            ports,
            secret,
            community,
            description,
        };

        const newNas = await radiusRepo.createNas(nasData);

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