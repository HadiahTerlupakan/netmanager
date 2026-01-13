import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { workOrderCacheService } from '@/modules/work-order/services/WorkOrderCacheService';

const workOrderRepo = new WorkOrderRepository(prisma);

/**
 * GET /api/admin/workorders/dashboard
 * 
 * Consolidated dashboard endpoint - combines 6 API calls into 1
 * Reduces network overhead and ensures consistent data snapshot
 * 
 * Features:
 * - Redis caching (60s TTL for dashboard data)
 * - Parallel database queries
 * - Permission-based filtering
 * 
 * Original endpoints consolidated:
 * - /api/admin/workorders/stats
 * - /api/admin/workorders/recent
 * - /api/admin/workorders/department-workload
 * - /api/admin/workorders/top-performers
 * - /api/admin/workorders/analytics
 * - /api/admin/workorders/response-stats
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
        const period = searchParams.get('period') || 'all_time';

        // Build access restriction filters
        const { departmentId, siteId, emptyResponse } = buildAccessFilters(user);

        // If user has no access, return empty data
        if (emptyResponse) {
            return NextResponse.json({
                success: true,
                data: getEmptyDashboardData(),
                message: "Restricted access: No department/site assigned."
            });
        }

        // PHASE 4: Try to get cached data first
        const cachedData = await workOrderCacheService.getCachedDashboardData(
            user.id,
            period,
            { departmentId, siteId }
        );

        if (cachedData) {
            return NextResponse.json({
                success: true,
                data: cachedData,
                cached: true, // Indicate data is from cache
            });
        }

        // Build date filters based on period
        const { dateFrom, dateTo } = buildDateRange(period);

        // Execute all queries in parallel for maximum performance
        const [
            stats,
            recentWorkOrders,
            departmentWorkload,
            topPerformers,
            topAssists,
            issueStats,
            siteStats,
            disconnectionStats,
            responseStats,
            adminKPI
        ] = await Promise.all([
            // Stats
            workOrderRepo.getStatistics({
                departmentId,
                siteId,
            }),
            // Recent work orders (optimized - only 5)
            workOrderRepo.getRecentWorkOrders(5, { departmentId }),
            // Department workload
            workOrderRepo.getDepartmentWorkload(departmentId),
            // Top performers
            workOrderRepo.getTopPerformers(5, dateFrom, dateTo, departmentId),
            // Top assists
            workOrderRepo.getTopAssists(5, dateFrom, dateTo, departmentId),
            // Issue statistics
            workOrderRepo.getIssueStatistics(5, dateFrom, dateTo, departmentId, siteId),
            // Site statistics
            workOrderRepo.getSiteStatistics(5, dateFrom, dateTo, departmentId, siteId),
            // Disconnection statistics
            workOrderRepo.getDisconnectionStatistics(dateFrom, dateTo, departmentId, siteId),
            // Response stats
            workOrderRepo.getAdminResponseStats(
                dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default: last 30 days
                dateTo || new Date(),
                departmentId
            ),
            // Admin KPI stats
            workOrderRepo.getAdminKPIStats(departmentId, siteId),
        ]);

        const dashboardData = {
            stats,
            recentWorkOrders,
            departmentWorkload,
            topPerformers,
            topAssists,
            issueStats,
            siteStats,
            disconnectionStats,
            responseStats,
            adminKPI,
        };

        // PHASE 4: Cache the result
        await workOrderCacheService.cacheDashboardData(
            user.id,
            period,
            dashboardData,
            { departmentId, siteId }
        );

        return NextResponse.json({
            success: true,
            data: dashboardData,
            cached: false,
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
    }
}

/**
 * Build date range based on period parameter
 */
function buildDateRange(period: string): { dateFrom?: Date; dateTo?: Date } {
    const now = new Date();
    let dateFrom: Date | undefined;
    let dateTo: Date | undefined = new Date();

    switch (period) {
        case 'daily':
            dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
        case 'weekly':
            const firstDay = now.getDate() - now.getDay();
            dateFrom = new Date(now.getFullYear(), now.getMonth(), firstDay);
            break;
        case 'monthly':
            dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 'yearly':
            dateFrom = new Date(now.getFullYear(), 0, 1);
            break;
        case 'last_30_days':
            dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            break;
        case 'all_time':
        default:
            // No date filter for all_time
            dateFrom = undefined;
            dateTo = undefined;
            break;
    }

    return { dateFrom, dateTo };
}

/**
 * Build access restriction filters based on user permissions
 */
function buildAccessFilters(user: any): {
    departmentId?: string;
    siteId?: string;
    emptyResponse: boolean;
} {
    const hasDepartmentRestriction = user.permissions?.includes('workorders:department_only');
    const hasSiteRestriction = user.permissions?.includes('workorders:site_only');
    const isSuperAdmin = user.role === 'SUPER_ADMIN';

    let departmentId: string | undefined;
    let siteId: string | undefined;
    let emptyResponse = false;

    // Department restriction
    if (hasDepartmentRestriction && !isSuperAdmin) {
        if (!user.departmentId) {
            emptyResponse = true;
        } else {
            departmentId = user.departmentId;
        }
    }

    // Site restriction
    if (hasSiteRestriction && !isSuperAdmin) {
        if (!user.siteId) {
            emptyResponse = true;
        } else {
            siteId = user.siteId;
        }
    }

    return { departmentId, siteId, emptyResponse };
}

/**
 * Return empty dashboard data structure
 */
function getEmptyDashboardData() {
    return {
        stats: {
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
        recentWorkOrders: [],
        departmentWorkload: [],
        topPerformers: [],
        topAssists: [],
        issueStats: [],
        siteStats: [],
        disconnectionStats: [],
        responseStats: [],
        adminKPI: {
            pendingVerification: 0,
            avgVerificationTimeMinutes: 0,
            avgOnHoldResponseMinutes: 0,
            verifiedToday: 0,
            verifiedThisWeek: 0,
        },
    };
}
