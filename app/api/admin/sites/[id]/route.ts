import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

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

        const { id } = await params;

        const site = await prisma.site.findUnique({
            where: { id },
            include: {
                users: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        department: {
                            select: { name: true },
                        },
                    },
                },
                _count: {
                    select: {
                        workOrders: true,
                    },
                },
                gudangs: { // Include assigned warehouses
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

        const { id } = await params;
        const body = await request.json();
        const { code, name, description, address, latitude, longitude, isActive, gudangIds } = body;

        // Check if site exists
        const existingSite = await prisma.site.findUnique({
            where: { id },
        });

        if (!existingSite) {
            return NextResponse.json({ error: 'Site not found' }, { status: 404 });
        }

        // If updating code, check for duplicates
        if (code && code !== existingSite.code) {
            const duplicateCode = await prisma.site.findUnique({
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
            const updatedSite = await tx.site.update({
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
                },
            });

            // 2. Handle Gudang Assignment (only if gudangIds is provided)
            if (Array.isArray(gudangIds)) {
                // a. Unassign ALL gudangs currently assigned to this site
                // This ensures that if a user deselects a warehouse, it gets removed.
                await tx.gudang.updateMany({
                    where: { siteId: id },
                    data: { siteId: null }
                });

                // b. Assign the new list of gudangs
                if (gudangIds.length > 0) {
                    await tx.gudang.updateMany({
                        where: { id: { in: gudangIds } },
                        data: { siteId: id }
                    });
                }
            }

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

        const { id } = await params;

        // Check if site has employees or work orders
        const site = await prisma.site.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        users: true,
                        workOrders: true,
                    },
                },
            },
        });

        if (!site) {
            return NextResponse.json({ error: 'Site not found' }, { status: 404 });
        }

        if (site._count.users > 0 || site._count.workOrders > 0) {
            // Soft delete - deactivate instead
            await prisma.site.update({
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
        await prisma.site.delete({
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
