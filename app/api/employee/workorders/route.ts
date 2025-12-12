import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';
import { checkEmployeeFeatureAccess } from '@/lib/utils/permissions';

// GET /api/employee/workorders - Get work orders for employee based on site
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get employee from user with site info
        const employee = await prisma.employee.findUnique({
            where: { userId: user.id },
            include: {
                department: true,
                site: true,
            },
        });

        if (!employee) {
            return NextResponse.json(
                { error: 'Employee profile not found' },
                { status: 404 }
            );
        }

        // Check if employee has permission to access work orders
        const hasAccess = await checkEmployeeFeatureAccess(
            employee.employeeId,
            'WORKORDERS',
            user.role
        );

        if (!hasAccess) {
            return NextResponse.json(
                { error: 'You do not have permission to access work orders' },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const tab = searchParams.get('tab') || 'all'; // 'available', 'my', 'all'
        const status = searchParams.get('status');
        const search = searchParams.get('search');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const skip = (page - 1) * limit;

        // Build where clause based on tab
        let where: any = {};

        if (tab === 'available') {
            // Available: PENDING work orders in same site (not yet claimed)
            where = {
                status: 'PENDING',
                assignedToId: null,
                ...(employee.siteId ? { siteId: employee.siteId } : {}),
            };
        } else if (tab === 'my') {
            // My tickets: Assigned to this employee
            where = {
                assignedToId: employee.id,
                status: { in: ['ASSIGNED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED'] },
            };
        } else {
            // All: Both available in site and assigned to me
            where = {
                OR: [
                    // Available in my site
                    {
                        status: 'PENDING',
                        assignedToId: null,
                        ...(employee.siteId ? { siteId: employee.siteId } : {}),
                    },
                    // Assigned to me
                    { assignedToId: employee.id },
                    // In my department
                    ...(employee.departmentId ? [{ departmentId: employee.departmentId }] : []),
                ],
            };
        }

        // Add status filter if provided
        if (status && tab !== 'available') {
            if (where.OR) {
                where.AND = [{ status: status.includes(',') ? { in: status.split(',') } : status }];
            } else {
                where.status = status.includes(',') ? { in: status.split(',') } : status;
            }
        }

        // Add search filter
        if (search) {
            const searchFilter = {
                OR: [
                    { workOrderNumber: { contains: search, mode: 'insensitive' as const } },
                    { title: { contains: search, mode: 'insensitive' as const } },
                    { description: { contains: search, mode: 'insensitive' as const } },
                ],
            };
            if (where.AND) {
                where.AND.push(searchFilter);
            } else {
                where.AND = [searchFilter];
            }
        }

        // Fetch work orders
        const [workOrders, total] = await Promise.all([
            prisma.workOrder.findMany({
                where,
                include: {
                    pelanggan: {
                        select: { id: true, idPelanggan: true, nama: true, noTelp: true },
                    },
                    site: { select: { id: true, code: true, name: true } },
                    assignedTo: { select: { id: true, fullName: true } },
                    tasks: { orderBy: { order: 'asc' } },
                    _count: { select: { updates: true, attachments: true } },
                },
                orderBy: [
                    { priority: 'desc' },
                    { createdAt: 'desc' },
                ],
                skip,
                take: limit,
            }),
            prisma.workOrder.count({ where }),
        ]);

        // Get stats for tabs
        const [availableCount, myCount] = await Promise.all([
            prisma.workOrder.count({
                where: {
                    status: 'PENDING',
                    assignedToId: null,
                    ...(employee.siteId ? { siteId: employee.siteId } : {}),
                },
            }),
            prisma.workOrder.count({
                where: {
                    assignedToId: employee.id,
                    status: { in: ['ASSIGNED', 'IN_PROGRESS', 'ON_HOLD'] },
                },
            }),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                workOrders,
                total,
                page,
                totalPages: Math.ceil(total / limit),
                stats: {
                    available: availableCount,
                    myTickets: myCount,
                },
            },
        });
    } catch (error) {
        console.error('Error fetching employee work orders:', error);
        return NextResponse.json(
            { error: 'Failed to fetch work orders' },
            { status: 500 }
        );
    }
}
