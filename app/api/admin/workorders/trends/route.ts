import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';

const workOrderRepo = new WorkOrderRepository(prisma);

/**
 * GET /api/admin/workorders/trends
 * 
 * Trend analytics endpoint for Work Order Dashboard
 * Returns 4 types of trends with custom date range:
 * 1. Volume Trend - WO created vs completed per month
 * 2. Issue Trend - Issue distribution per month
 * 3. Performance Trend - Avg completion time & rating per month
 * 4. Type Trend - WO type distribution per month
 * 
 * Query Parameters:
 * - startDate: ISO date string (required)
 * - endDate: ISO date string (required)
 */
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
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');

        // Validate required parameters
        if (!startDateParam || !endDateParam) {
            return NextResponse.json(
                { error: 'startDate and endDate are required' },
                { status: 400 }
            );
        }

        const startDate = new Date(startDateParam);
        const endDate = new Date(endDateParam);

        // Validate dates
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return NextResponse.json(
                { error: 'Invalid date format' },
                { status: 400 }
            );
        }

        if (startDate > endDate) {
            return NextResponse.json(
                { error: 'startDate must be before endDate' },
                { status: 400 }
            );
        }

        // Build access restriction filters
        const { departmentId, siteId } = buildAccessFilters(user);

        // Execute all trend queries in parallel
        const [volumeTrend, issueTrend, performanceTrend, typeTrend] = await Promise.all([
            workOrderRepo.getVolumeTrend(startDate, endDate, departmentId, siteId),
            workOrderRepo.getIssueTrend(startDate, endDate, departmentId, siteId),
            workOrderRepo.getPerformanceTrend(startDate, endDate, departmentId, siteId),
            workOrderRepo.getTypeTrend(startDate, endDate, departmentId, siteId),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                volumeTrend,
                issueTrend,
                performanceTrend,
                typeTrend,
            },
            dateRange: {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString(),
            }
        });
    } catch (error) {
        console.error('Error fetching WO trends:', error);
        return NextResponse.json({ error: 'Failed to fetch trends' }, { status: 500 });
    }
}

/**
 * Build access restriction filters based on user permissions
 */
function buildAccessFilters(user: any): {
    departmentId?: string;
    siteId?: string;
} {
    const hasDepartmentRestriction = user.permissions?.includes('workorders:department_only');
    const hasSiteRestriction = user.permissions?.includes('workorders:site_only');
    const isSuperAdmin = user.role === 'SUPER_ADMIN';

    let departmentId: string | undefined;
    let siteId: string | undefined;

    // Department restriction
    if (hasDepartmentRestriction && !isSuperAdmin && user.departmentId) {
        departmentId = user.departmentId;
    }

    // Site restriction
    if (hasSiteRestriction && !isSuperAdmin && user.siteId) {
        siteId = user.siteId;
    }

    return { departmentId, siteId };
}
