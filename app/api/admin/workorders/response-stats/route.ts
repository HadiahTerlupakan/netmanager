import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';

const workOrderRepo = new WorkOrderRepository(prisma);

// GET /api/admin/workorders/response-stats
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
        const period = searchParams.get('period') || 'last_30_days'; // default
        let departmentId = searchParams.get('departmentId') || undefined;

        let dateFrom: Date;
        let dateTo: Date = new Date(); // now

        // Date calculation logic (consistent with other stats)
        if (period === 'daily') {
            const now = new Date();
            dateFrom = new Date(now.setHours(0, 0, 0, 0));
        } else if (period === 'weekly') {
            const now = new Date();
            const firstDay = now.getDate() - now.getDay(); 
            dateFrom = new Date(now.setDate(firstDay));
            dateFrom.setHours(0, 0, 0, 0);
        } else if (period === 'monthly') {
            const now = new Date();
            dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (period === 'last_30_days') {
            const now = new Date();
            dateFrom = new Date(now.setDate(now.getDate() - 30));
        } else {
             // Default to last 30 days if unknown
            const now = new Date();
            dateFrom = new Date(now.setDate(now.getDate() - 30));
        }

        // Enforce Department Restriction
        const hasDepartmentRestriction = user.permissions?.includes('workorders:department_only');
        const isSuperAdmin = user.role === 'SUPER_ADMIN';

        if (hasDepartmentRestriction && !isSuperAdmin) {
            if (!user.departmentId) {
                return NextResponse.json({
                    success: true,
                    data: [] // No access to any department data
                });
            }
            departmentId = user.departmentId;
        }

        const stats = await workOrderRepo.getAdminResponseStats(dateFrom, dateTo, departmentId);

        return NextResponse.json({
            success: true,
            data: stats,
        });

    } catch (error) {
        console.error('Error fetching admin response stats:', error);
        return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 });
    }
}
