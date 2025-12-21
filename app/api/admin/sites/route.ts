import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// GET /api/admin/sites - List all sites
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search');
        const activeOnly = searchParams.get('activeOnly') === 'true';

        const where: any = {};
        if (activeOnly) {
            where.isActive = true;
        }
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { address: { contains: search, mode: 'insensitive' } },
            ];
        }

        const sites = await prisma.site.findMany({
            where,
            include: {
                _count: {
                    select: {
                        users: true,
                        workOrders: true,
                    },
                },
            },
            orderBy: { name: 'asc' },
        });

        return NextResponse.json({
            success: true,
            data: sites,
        });
    } catch (error) {
        console.error('Error fetching sites:', error);
        return NextResponse.json({ error: 'Failed to fetch sites' }, { status: 500 });
    }
}

// POST /api/admin/sites - Create new site
export async function POST(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { code, name, description, address, latitude, longitude, gudangIds } = body;

        if (!code || !name) {
            return NextResponse.json(
                { error: 'Code and name are required' },
                { status: 400 }
            );
        }

        // Check if code already exists
        const existingSite = await prisma.site.findUnique({
            where: { code },
        });

        if (existingSite) {
            return NextResponse.json(
                { error: 'Site code already exists' },
                { status: 400 }
            );
        }

        // Use transaction for atomic creation and assignment
        const site = await prisma.$transaction(async (tx) => {
            // 1. Create Site with Gudangs assignment
            const newSite = await tx.site.create({
                data: {
                    code: code.toUpperCase(),
                    name,
                    description,
                    address,
                    latitude: latitude ? parseFloat(latitude) : null,
                    longitude: longitude ? parseFloat(longitude) : null,
                    attendanceRadius: body.attendanceRadius ? parseInt(body.attendanceRadius) : 100,
                    gudangs: {
                        connect: Array.isArray(gudangIds) ? gudangIds.map((id: string) => ({ id })) : []
                    }
                },
            });

            // 2. No separate assignment needed for M-N relation via connect

            return newSite;
        });

        // System Log
        try {
            const { logger } = await import('@/lib/logger');
            await logger.logActivity({
                action: 'CREATE',
                subject: 'Site',
                userId: user.id,
                details: {
                    id: site.id,
                    name: site.name,
                    code: site.code,
                    assignedGudangs: gudangIds?.length || 0
                }
            });
        } catch (e) {
            console.error('Logging failed', e);
        }

        return NextResponse.json({
            success: true,
            data: site,
            message: 'Site created successfully',
        });
    } catch (error) {
        console.error('Error creating site:', error);
        return NextResponse.json({ error: 'Failed to create site' }, { status: 500 });
    }
}
