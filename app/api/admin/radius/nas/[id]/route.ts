/**
 * NAS Management API by ID
 * GET /api/admin/radius/nas/[id] - Get NAS by ID
 * PUT /api/admin/radius/nas/[id] - Update NAS
 * DELETE /api/admin/radius/nas/[id] - Delete NAS
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RadiusRepository } from '@/modules/network/repositories/RadiusRepository';
import type { INas } from '@/modules/network/repositories/IRadiusRepository';

interface RouteContext {
    params: Promise<{
        id: string;
    }>;
}

export async function GET(req: NextRequest, context: RouteContext) {
    try {
        // Auth check
        const session = await getServerSession(authConfig);
        if (!session?.user || false) {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 401 }
            );
        }

        const { id: idStr } = await context.params;
        const id = parseInt(idStr);
        if (isNaN(id)) {
            return NextResponse.json(
                { error: 'Invalid NAS ID' },
                { status: 400 }
            );
        }

        const radiusRepo = new RadiusRepository(prisma);
        const nas = await radiusRepo.getNasById(id);

        if (!nas) {
            return NextResponse.json(
                { error: 'NAS not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: nas,
        });
    } catch (error) {
        console.error('NAS get error:', error);
        return NextResponse.json(
            {
                error: 'Failed to fetch NAS',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

export async function PUT(req: NextRequest, context: RouteContext) {
    try {
        // Auth check
        const session = await getServerSession(authConfig);
        if (!session?.user || false) {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 401 }
            );
        }

        const { id: idStr } = await context.params;
        const id = parseInt(idStr);
        if (isNaN(id)) {
            return NextResponse.json(
                { error: 'Invalid NAS ID' },
                { status: 400 }
            );
        }

        const body = await req.json();
        const { nasname, shortname, type, ports, secret, community, description } = body;

        const radiusRepo = new RadiusRepository(prisma);

        // Check if NAS exists
        const existingNas = await radiusRepo.getNasById(id);
        if (!existingNas) {
            return NextResponse.json(
                { error: 'NAS not found' },
                { status: 404 }
            );
        }

        // Check if new nasname conflicts with existing NAS (if changing)
        if (nasname && nasname !== existingNas.nasname) {
            const conflictNas = await radiusRepo.getNasByIp(nasname);
            if (conflictNas) {
                return NextResponse.json(
                    { error: 'NAS with this IP/hostname already exists' },
                    { status: 409 }
                );
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

        return NextResponse.json({
            success: true,
            message: 'NAS updated successfully',
            data: updatedNas,
        });
    } catch (error) {
        console.error('NAS update error:', error);
        return NextResponse.json(
            {
                error: 'Failed to update NAS',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
    try {
        // Auth check
        const session = await getServerSession(authConfig);
        if (!session?.user || false) {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 401 }
            );
        }

        const { id: idStr } = await context.params;
        const id = parseInt(idStr);
        if (isNaN(id)) {
            return NextResponse.json(
                { error: 'Invalid NAS ID' },
                { status: 400 }
            );
        }

        const radiusRepo = new RadiusRepository(prisma);

        // Check if NAS exists
        const existingNas = await radiusRepo.getNasById(id);
        if (!existingNas) {
            return NextResponse.json(
                { error: 'NAS not found' },
                { status: 404 }
            );
        }

        await radiusRepo.deleteNas(id);

        return NextResponse.json({
            success: true,
            message: 'NAS deleted successfully',
        });
    } catch (error) {
        console.error('NAS delete error:', error);
        return NextResponse.json(
            {
                error: 'Failed to delete NAS',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}