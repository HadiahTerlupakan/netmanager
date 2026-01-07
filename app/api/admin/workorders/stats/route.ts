import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';

const workOrderRepo = new WorkOrderRepository(prisma);

// GET /api/admin/workorders/stats - Get statistics
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!await hasPermission('work_order_dashboard:read')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const departmentId = searchParams.get('departmentId');
        const assignedToId = searchParams.get('assignedToId');

        const filters: any = {};
        if (departmentId) filters.departmentId = departmentId;
        if (assignedToId) filters.assignedToId = assignedToId;

        // NEW: Enforce Department Restriction Logic
        // If user has 'department_only' permission and is NOT a Super Admin, force restrict to their department
        const hasDepartmentRestriction = user.permissions?.includes('workorders:department_only');
        const isSuperAdmin = user.role === 'SUPER_ADMIN';

        if (hasDepartmentRestriction && !isSuperAdmin) {
            if (!user.departmentId) {
                // If restricted but no department assigned, return empty stats or throw error?
                // For stats, returning 0s is safer than error
                 return NextResponse.json({
                    success: true,
                    data: {
                        total: 0,
                        pending: 0,
                        assigned: 0,
                        inProgress: 0,
                        onHold: 0,
                        completed: 0,
                        verified: 0,
                        closed: 0,
                        cancelled: 0,
                        urgentOpen: 0,
                        avgCompletionTimeHours: 0,
                        totalCost: 0,
                        avgRating: null,
                        totalWithRating: 0
                    },
                });
            }
            // Force override any client-provided departmentId
            filters.departmentId = user.departmentId;
        }

        // NEW: Enforce Site Restriction Logic
        const hasSiteRestriction = user.permissions?.includes('workorders:site_only');
        if (hasSiteRestriction && !isSuperAdmin) {
             if (!user.siteId) {
                 return NextResponse.json({
                    success: true,
                    data: {
                        total: 0,
                        pending: 0,
                        assigned: 0,
                        inProgress: 0,
                        onHold: 0,
                        completed: 0,
                        verified: 0,
                        closed: 0,
                        cancelled: 0,
                        urgentOpen: 0,
                        avgCompletionTimeHours: 0,
                        totalCost: 0,
                        avgRating: null,
                        totalWithRating: 0
                    },
                });
            }
            filters.siteId = user.siteId;
        }

        const stats = await workOrderRepo.getStatistics(filters);

        return NextResponse.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        console.error('Error fetching statistics:', error);
        return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 });
    }
}
