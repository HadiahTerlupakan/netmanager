import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// GET /api/admin/departments/[id] - Get department details
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

        const department = await prisma.department.findUnique({
            where: { id },
            include: {
                users: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                    },
                    take: 10,
                },
                _count: {
                    select: {
                        users: true,
                        workOrders: true,
                    },
                },
            },
        });

        if (!department) {
            return NextResponse.json({ error: 'Department not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: department,
        });
    } catch (error) {
        console.error('Error fetching department:', error);
        return NextResponse.json({ error: 'Failed to fetch department' }, { status: 500 });
    }
}

// PATCH /api/admin/departments/[id] - Update department
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
        const { name, description, jobDescription } = body;

        // Check if department exists
        const existingDept = await prisma.department.findUnique({
            where: { id },
        });

        if (!existingDept) {
            return NextResponse.json({ error: 'Department not found' }, { status: 404 });
        }

        // If updating name, check for duplicates
        if (name && name !== existingDept.name) {
            const duplicateName = await prisma.department.findUnique({
                where: { name },
            });

            if (duplicateName) {
                return NextResponse.json(
                    { error: 'Department name already exists' },
                    { status: 400 }
                );
            }
        }

        const department = await prisma.department.update({
            where: { id },
            data: {
                ...(name && { name }),
                ...(description !== undefined && { description: description || null }),
                ...(jobDescription !== undefined && { jobDescription: jobDescription || null }),
            },
        });

        // System Log
        try {
            const { logger } = await import('@/lib/logger');
            await logger.logActivity({
                action: 'UPDATE',
                subject: 'Department',
                userId: user.id,
                details: { id: department.id, updates: body }
            });
        } catch (e) {
            console.error('Logging failed', e);
        }

        return NextResponse.json({
            success: true,
            data: department,
            message: 'Department updated successfully',
        });
    } catch (error) {
        console.error('Error updating department:', error);
        return NextResponse.json({ error: 'Failed to update department' }, { status: 500 });
    }
}

// DELETE /api/admin/departments/[id] - Delete department
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

        // Check if department has employees or work orders
        const department = await prisma.department.findUnique({
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

        if (!department) {
            return NextResponse.json({ error: 'Department not found' }, { status: 404 });
        }

        if (department._count.users > 0) {
            return NextResponse.json(
                { error: `Cannot delete department. It has ${department._count.users} user(s) assigned.` },
                { status: 400 }
            );
        }

        if (department._count.workOrders > 0) {
            return NextResponse.json(
                { error: `Cannot delete department. It has ${department._count.workOrders} work order(s) assigned.` },
                { status: 400 }
            );
        }

        // Safe to delete
        await prisma.department.delete({
            where: { id },
        });

        // System Log
        try {
            const { logger } = await import('@/lib/logger');
            await logger.logActivity({
                action: 'DELETE',
                subject: 'Department',
                userId: user.id,
                details: { id: department.id, name: department.name }
            });
        } catch (e) {
            console.error('Logging failed', e);
        }

        return NextResponse.json({
            success: true,
            message: 'Department deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting department:', error);
        return NextResponse.json({ error: 'Failed to delete department' }, { status: 500 });
    }
}
