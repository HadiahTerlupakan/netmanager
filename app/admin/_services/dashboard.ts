import { getAttendanceRepository, getWorkOrderRepository } from '@/lib/repositories';
import { prisma } from '@/lib/prisma'; // Optional if repos are enough, but we need User details efficiently.

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

/**
 * Get Top 5 Employees based on integrated score (Attendance + WorkOrder)
 * Score = Attendance Days + Completed Work Orders
 */
export async function getTopEmployees(limit: number = 5): Promise<TopEmployee[]> {
    const attendanceRepo = getAttendanceRepository();
    const workOrderRepo = getWorkOrderRepository();
    // userRepo not used, removed to fix linting

    // Default to last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    // 1. Fetch Stats in parallel
    const [attendanceStats, workOrderStats] = await Promise.all([
        attendanceRepo.getUserAttendanceStats(startDate, endDate),
        workOrderRepo.getUserWorkOrderStats(startDate, endDate),
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
        // Ensure we handle non-null userId from repo
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
    // Using prisma directly for efficient inclusion of relations, or repo if available.
    // Repo typically returns `User` model, might need relations.
    // Let's use prisma directly here for efficiency as `getUserRepository` might not expose batch with specific relations.
    const users = await prisma.user.findMany({
        where: {
            id: {
                in: sortedIds.map(([id]) => id),
            },
        },
        select: {
            id: true,
            name: true,
            image: true,
            role: {
                select: { name: true },
            },
            departments: {
                select: { name: true },
            },
            sites: {
                select: { name: true },
            },
        },
    });

    // 5. Map to Result
    return sortedIds.map(([userId, score], index) => {
        const user = users.find((u) => u.id === userId);
        return {
            userId,
            name: user?.name || 'Unknown',
            role: user?.role?.name || null,
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
    }).filter(u => u.name !== 'Unknown'); // Safety check
}

/**
 * Get Top 5 Problematic Sites (High TROUBLESHOOT count)
 */
export async function getTopProblematicSites(limit: number = 5) {
    const workOrderRepo = getWorkOrderRepository();
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    return workOrderRepo.getSiteStatsByType(['TROUBLESHOOT'], limit, startDate, endDate);
}

/**
 * Get Top 5 Dismantle Sites (High DISCONNECTION count)
 */
export async function getTopDismantleSites(limit: number = 5) {
    const workOrderRepo = getWorkOrderRepository();
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    return workOrderRepo.getSiteStatsByType(['DISCONNECTION'], limit, startDate, endDate);
}

/**
 * Get Top 5 Installation Sites (High INSTALLATION count)
 */
export async function getTopInstallationSites(limit: number = 5) {
    const workOrderRepo = getWorkOrderRepository();
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);

    return workOrderRepo.getSiteStatsByType(['INSTALLATION'], limit, startDate, endDate);
}
