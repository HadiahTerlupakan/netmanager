import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository';
import { verifyAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/rbac';
import { workOrderCacheService } from '@/modules/work-order/services/WorkOrderCacheService';
import { apiSuccess, ApiErrors } from '@/lib/api-response';

const workOrderRepo = new WorkOrderRepository(prisma);

/**
 * GET /api/admin/workorders/dashboard
 * 
 * Consolidated dashboard endpoint - combines 6 API calls into 1
 * Reduces network overhead and ensures consistent data snapshot
 */
export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return ApiErrors.unauthorized('Session tidak valid');
        }

        if (!await hasPermission('work_order_dashboard:read')) {
            return ApiErrors.forbidden('Anda tidak memiliki akses untuk melihat dashboard work order');
        }

        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period') || 'all_time';

        // Build access restriction filters
        const { departmentId, siteId, emptyResponse } = buildAccessFilters(user);

        // If user has no access, return empty data
        if (emptyResponse) {
            return apiSuccess({
                ...getEmptyDashboardData(),
                message: "Restricted access: No department/site assigned."
            });
        }

        // PHASE 4: Try to get cached data first
        const cachedData = await workOrderCacheService.getCachedDashboardData(
            user.id,
            period,
            { 
                ...(departmentId ? { departmentId } : {}), 
                ...(siteId ? { siteId } : {}) 
            }
        );

        if (cachedData) {
            return apiSuccess({
                ...(cachedData as Record<string, unknown>),
                cached: true,
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
                ...(departmentId ? { departmentId } : {}),
                ...(siteId ? { siteId } : {})
            }),
            // Recent work orders (optimized - only 5)
            workOrderRepo.getRecentWorkOrders(5, { 
                ...(departmentId ? { departmentId } : {}) 
            }),
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

        // Count WO by type (Customer vs Internal) - using isInternal field
        const baseWhere = {
            ...(departmentId ? { departmentId } : {}),
            ...(siteId ? { siteId } : {}),
        };
        
        const [customerCount, internalCount] = await Promise.all([
            // Customer WO: isInternal = false
            prisma.workOrders.count({
                where: {
                    ...baseWhere,
                    isInternal: false,
                }
            }),
            // Internal WO: isInternal = true
            prisma.workOrders.count({
                where: {
                    ...baseWhere,
                    isInternal: true,
                }
            }),
        ]);
        
        const woTypeStats = { customer: customerCount, internal: internalCount };

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
            woTypeStats, // Customer vs Internal count
        };

        // PHASE 4: Cache the result
        await workOrderCacheService.cacheDashboardData(
            user.id,
            period,
            dashboardData,
            { 
                ...(departmentId ? { departmentId } : {}), 
                ...(siteId ? { siteId } : {}) 
            }
        );

        return apiSuccess({
            ...dashboardData,
            cached: false,
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        return ApiErrors.internalError('Gagal mengambil data dashboard');
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

    return { 
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {})
    };
}

/**
 * Build access restriction filters based on user permissions
 */
function buildAccessFilters(user: { id: string; permissions?: string[]; role?: string; departmentId?: string | null; siteId?: string | null }): {
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

    return { 
        ...(departmentId ? { departmentId } : {}),
        ...(siteId ? { siteId } : {}),
        emptyResponse 
    };
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
            avgRating: null as number | null,
            totalWithRating: 0
        },
        recentWorkOrders: [] as unknown[],
        departmentWorkload: [] as unknown[],
        topPerformers: [] as unknown[],
        topAssists: [] as unknown[],
        issueStats: [] as unknown[],
        siteStats: [] as unknown[],
        disconnectionStats: [] as unknown[],
        responseStats: [] as unknown[],
        adminKPI: {
            pendingVerification: 0,
            avgVerificationTimeMinutes: 0,
            avgOnHoldResponseMinutes: 0,
            verifiedToday: 0,
            verifiedThisWeek: 0,
        },
        woTypeStats: {
            customer: 0,
            internal: 0,
        },
    };
}
