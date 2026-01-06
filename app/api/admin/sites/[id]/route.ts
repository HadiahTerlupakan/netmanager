import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';

// GET /api/admin/sites/[id] - Get site details
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!await hasPermission('site:read')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;

        const site = await prisma.sites.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        departments: {
                            select: { name: true },
                        },
                    },
                },
                _count: {
                    select: {
                        work_orders: true,
                    },
                },
                gudang: { // Include assigned warehouses
                    select: {
                        id: true,
                        nama: true,
                        kode: true
                    }
                }
            },
        });

        if (!site) {
            return NextResponse.json({ error: 'Site not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: site,
        });
    } catch (error) {
        console.error('Error fetching site:', error);
        return NextResponse.json({ error: 'Failed to fetch site' }, { status: 500 });
    }
}

// PATCH /api/admin/sites/[id] - Update site
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!await hasPermission('site:update')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const { code, name, description, address, latitude, longitude, isActive, gudangIds } = body;

        // Check if site exists
        const existingSite = await prisma.sites.findUnique({
            where: { id },
        });

        if (!existingSite) {
            return NextResponse.json({ error: 'Site not found' }, { status: 404 });
        }

        // If updating code, check for duplicates
        if (code && code !== existingSite.code) {
            const duplicateCode = await prisma.sites.findUnique({
                where: { code: code.toUpperCase() },
            });

            if (duplicateCode) {
                return NextResponse.json(
                    { error: 'Site code already exists' },
                    { status: 400 }
                );
            }
        }

        // Use transaction for atomic full update
        const site = await prisma.$transaction(async (tx) => {
            // 1. Update Site details
            const updatedSite = await tx.sites.update({
                where: { id },
                data: {
                    ...(code && { code: code.toUpperCase() }),
                    ...(name && { name }),
                    ...(description !== undefined && { description }),
                    ...(address !== undefined && { address }),
                    ...(latitude !== undefined && { latitude: latitude ? parseFloat(latitude) : null }),
                    ...(longitude !== undefined && { longitude: longitude ? parseFloat(longitude) : null }),
                    ...(body.attendanceRadius !== undefined && { attendanceRadius: parseInt(body.attendanceRadius) }),
                    ...(isActive !== undefined && { isActive }),
                    gudang: Array.isArray(gudangIds) ? {
                        set: gudangIds.map((id: string) => ({ id }))
                    } : undefined,
                },
            });

            // 2. Gudang Assignment handled by 'set' above

            return updatedSite;
        });

        // System Log
        try {
            const { logger } = await import('@/lib/logger');
            await logger.logActivity({
                action: 'UPDATE',
                subject: 'Site',
                userId: user.id,
                details: {
                    id: site.id,
                    updates: { ...body, gudangIdsCount: Array.isArray(gudangIds) ? gudangIds.length : 'unchanged' }
                }
            });
        } catch (e) {
            console.error('Logging failed', e);
        }

        return NextResponse.json({
            success: true,
            data: site,
            message: 'Site updated successfully',
        });
    } catch (error) {
        console.error('Error updating site:', error);
        return NextResponse.json({ error: 'Failed to update site' }, { status: 500 });
    }
}

// DELETE /api/admin/sites/[id] - Delete site
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!await hasPermission('site:delete')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;

        // Check if site has employees or work orders
        const site = await prisma.sites.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        user: true,
                        work_orders: true,
                    },
                },
            },
        });

        if (!site) {
            return NextResponse.json({ error: 'Site not found' }, { status: 404 });
        }

        if (site._count.user > 0 || site._count.work_orders > 0) {
            // Soft delete - deactivate instead
            await prisma.sites.update({
                where: { id },
                data: { isActive: false },
            });

            // System Log
            try {
                const { logger } = await import('@/lib/logger');
                await logger.logActivity({
                    action: 'UPDATE', // Soft delete / Deactivate
                    subject: 'Site',
                    userId: user.id,
                    details: { id: site.id, name: site.name, status: 'DEACTIVATED' }
                });
            } catch (e) {
                console.error('Logging failed', e);
            }

            return NextResponse.json({
                success: true,
                message: 'Site deactivated (has associated users/work orders)',
            });
        }

        // Hard delete if no associations
        await prisma.sites.delete({
            where: { id },
        });

        // System Log
        try {
            const { logger } = await import('@/lib/logger');
            await logger.logActivity({
                action: 'DELETE',
                subject: 'Site',
                userId: user.id,
                details: { id: site.id, name: site.name }
            });
        } catch (e) {
            console.error('Logging failed', e);
        }

        return NextResponse.json({
            success: true,
            message: 'Site deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting site:', error);
        return NextResponse.json({ error: 'Failed to delete site' }, { status: 500 });
    }
}
