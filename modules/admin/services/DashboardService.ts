import { getAttendanceRepository, getWorkOrderRepository, getPointClaimRepository, getInventoryRepository } from '@/lib/repositories';
import { getUserRepository } from '@/lib/repositories';
import { toStartOfDay, toEndOfDay } from '@/lib/utils/server-datetime'


export type TopEmployee = {
    userId: string;
    name: string;
    role: string | null;
    department: string | null;
    site: string | null;
    avatar: string | null;
    metrics: {
        attendanceCount: number;
        workOrderCount: number;
        totalScore: number;
    };
    rank: number;
};

export type SystemSummary = {
    inventory: {
        totalItems: number;
        lowStockItems: number;
    };
    marketing: {
        totalPoints: number;
        pendingClaims: number;
        approvedClaims: number;
    };
    workOrder: {
        pending: number;
        inProgress: number;
        completed: number;
    };
    attendance: {
        present: number;
        late: number;
        absent: number;
    };
}

export class DashboardService {
    private attendanceRepo = getAttendanceRepository();
    private workOrderRepo = getWorkOrderRepository();
    private pointClaimRepo = getPointClaimRepository();
    private inventoryRepo = getInventoryRepository();
    private userRepo = getUserRepository();

    /**
     * Get Integrated System Summary
     */
    async getSystemSummary(): Promise<SystemSummary> {
        const today = new Date();
        const startOfDay = new Date(today.setTime(toStartOfDay(today).getTime()));
        const endOfDay = new Date(today.setTime(toEndOfDay(today).getTime()));

        // 1. Inventory Summary (Total Items)
        // Note: lowStockItems logic would normally require a threshold check per item.
        // For efficiency, we just grab total items for now.
        const inventory = await this.inventoryRepo.findAllBarang({ take: 1 });

        // 2. Marketing Summary (Aggregated for all sales)
        // We can't use getPointSummaryBySales for *all* sales efficiently without a loop.
        // Instead, we'll do a quick aggregate on PointClaim table directly via Repo if exposed,
        // or just fetch general claim stats.
        // Extending logic here manually since Repo doesn't have "global summary"
        const claims = await this.pointClaimRepo.findAll();
        let marketingPoints = 0;
        let pendingClaims = 0;
        let approvedClaims = 0;

        claims.forEach(c => {
            if (c.status === 'APPROVED') {
                marketingPoints += c.pointValue || 0;
                approvedClaims++;
            } else if (c.status === 'PENDING') {
                pendingClaims++;
            }
        });

        // 3. Work Order Summary (Current Status snapshot)
        // We can fetch stats for the last 30 days to give a "recent activity" vibe
        const woStartDate = new Date();
        woStartDate.setDate(woStartDate.getDate() - 30);

        // Note: The repo `getStatistics` returns a flat structure, not a nested statusBreakdown array.
        // Based on IWorkOrderRepository interface:
        // export interface WorkOrderStatistics {
        //    total: number;
        //    pending: number;
        //    assigned: number;
        //    inProgress: number;
        //    onHold: number;
        //    completed: number;
        //    verified: number;
        //    closed: number;
        //    cancelled: number;
        //    urgentOpen: number;
        //    ...
        // }
        const woStats = await this.workOrderRepo.getStatistics({ dateFrom: woStartDate });

        // 4. Attendance (Today's Realtime)
        // getDailyStats returns array of daily records. Since we pass startOfDay and endOfDay, it should return 1 record max.
        // Format: Array<{ date: string, present: number, late: number, absent: number, ... }>
        const dailyAttendance = await this.attendanceRepo.getDailyStats(startOfDay, endOfDay);
        const todayStats = dailyAttendance[0] || { present: 0, late: 0, absent: 0 };

        return {
            inventory: {
                totalItems: inventory.total,
                lowStockItems: 0 // Placeholder
            },
            marketing: {
                totalPoints: marketingPoints,
                pendingClaims,
                approvedClaims
            },
            workOrder: {
                // Map the flat stats directly
                pending: woStats.pending || 0,
                inProgress: woStats.inProgress || 0,
                completed: (woStats.completed || 0) + (woStats.verified || 0) + (woStats.closed || 0),
            },
            attendance: {
                present: todayStats.present || 0,
                late: todayStats.late || 0,
                absent: todayStats.absent || 0
            }
        };
    }

    /**
     * Get Top Employees based on integrated score (Attendance + WorkOrder)
     * Score = Attendance Days + Completed Work Orders
     */
    async getTopEmployees(limit: number = 5): Promise<TopEmployee[]> {
        // Default to last 30 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 30);

        // 1. Fetch Stats in parallel
        const [attendanceStats, workOrderStats] = await Promise.all([
            this.attendanceRepo.getUserAttendanceStats(startDate, endDate),
            this.workOrderRepo.getUserWorkOrderStats(startDate, endDate),
        ]);

        // 2. Merge Stats
        const userScores = new Map<string, { attendance: number; workOrder: number; total: number }>();

        // Process Attendance
        attendanceStats.forEach((stat) => {
            const userId = stat.userId;
            if (!userId) return;
            const count = stat._count._all;

            const current = userScores.get(userId) || { attendance: 0, workOrder: 0, total: 0 };
            current.attendance = count;
            current.total += count;
            userScores.set(userId, current);
        });

        // Process Work Orders
        workOrderStats.forEach((stat) => {
            const userId = stat.userId;
            if (!userId) return;

            const count = stat.count;
            const current = userScores.get(userId) || { attendance: 0, workOrder: 0, total: 0 };
            current.workOrder = count;
            current.total += count;
            userScores.set(userId, current);
        });

        // 3. Sort and Slice
        const sortedIds = Array.from(userScores.entries())
            .sort((a, b) => b[1].total - a[1].total)
            .slice(0, limit);

        if (sortedIds.length === 0) return [];

        // 4. Fetch User Details
        const users = await this.userRepo.findManyWithFullDetails(sortedIds.map(([id]) => id));

        // 5. Map to Result
        return sortedIds.map(([userId, score], index): TopEmployee => {
            const user = users.find((u: { id: string; name: string | null; image: string | null; sites: { name: string } | null; departments: { name: string } | null }) => u.id === userId);
            return {
                userId,
                name: user?.name || 'Unknown',
                role: null as string | null,
                department: user?.departments?.name || null,
                site: user?.sites?.name || null,
                avatar: user?.image || null,
                metrics: {
                    attendanceCount: score.attendance,
                    workOrderCount: score.workOrder,
                    totalScore: score.total,
                },
                rank: index + 1,
            };
        }).filter(u => u.name !== 'Unknown');
    }

    /**
     * Get Top Problematic Sites (High TROUBLESHOOT count)
     */
    async getTopProblematicSites(limit: number = 5) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 30);

        return this.workOrderRepo.getSiteStatsByType(['TROUBLESHOOT'], limit, startDate, endDate);
    }

    /**
     * Get Top Dismantle Sites (High DISCONNECTION count)
     */
    async getTopDismantleSites(limit: number = 5) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 30);

        return this.workOrderRepo.getSiteStatsByType(['DISCONNECTION'], limit, startDate, endDate);
    }

    /**
     * Get Top Installation Sites (High INSTALLATION count)
     */
    async getTopInstallationSites(limit: number = 5) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 30);

        return this.workOrderRepo.getSiteStatsByType(['INSTALLATION'], limit, startDate, endDate);
    }
}

// Singleton pattern (consistent with other services)
let instance: DashboardService | null = null;

export function getDashboardService(): DashboardService {
    if (!instance) {
        instance = new DashboardService();
    }
    return instance;
}
