import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';

const workOrderRepo = new WorkOrderRepository(prisma);

// GET /api/admin/workorders/analytics
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Permission check
        if (!await hasPermission('work_order_dashboard:read')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period') || 'all_time';

        let dateFrom: Date | undefined;
        let dateTo: Date | undefined;
        const now = new Date();

        if (period === 'daily') {
            dateFrom = new Date(now.setHours(0, 0, 0, 0));
            dateTo = new Date(now.setHours(23, 59, 59, 999));
        } else if (period === 'weekly') {
            const firstDay = now.getDate() - now.getDay(); // Sunday
            dateFrom = new Date(now.setDate(firstDay));
            dateFrom.setHours(0, 0, 0, 0);
            dateTo = new Date();
        } else if (period === 'monthly') {
            dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
            dateTo = new Date();
        } else if (period === 'yearly') {
            dateFrom = new Date(now.getFullYear(), 0, 1);
            dateTo = new Date();
        }

        const [issueStats, siteStats, disconnectionStats] = await Promise.all([
            workOrderRepo.getIssueStatistics(5, dateFrom, dateTo),
            workOrderRepo.getSiteStatistics(5, dateFrom, dateTo),
            workOrderRepo.getDisconnectionStatistics(dateFrom, dateTo)
        ]);

        return NextResponse.json({
            success: true,
            data: {
                issues: issueStats,
                sites: siteStats,
                disconnections: disconnectionStats
            },
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
    }
}
