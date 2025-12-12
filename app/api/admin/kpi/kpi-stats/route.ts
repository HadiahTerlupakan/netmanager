import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAuth } from '@/lib/auth';

// Helper to calculate difference in minutes
const diffMinutes = (d1: Date, d2: Date) => (d1.getTime() - d2.getTime()) / (1000 * 60);

export async function GET(request: NextRequest) {
    try {
        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : null;
        const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : null;

        // --- Technician Stats ---
        const technicianWhere: any = {
            status: { in: ['COMPLETED', 'VERIFIED', 'CLOSED'] },
        };
        if (startDate) technicianWhere.completedAt = { gte: startDate };
        if (endDate) technicianWhere.completedAt = { ...technicianWhere.completedAt, lte: endDate };

        const techWorkOrders = await prisma.workOrder.findMany({
            where: technicianWhere,
            include: { assignedTo: true },
        });

        const techStatsMap = new Map<string, {
            name: string;
            total: number;
            totalResponseMinutes: number;
            totalResolutionMinutes: number;
        }>();

        techWorkOrders.forEach(wo => {
            if (!wo.assignedToId || !wo.assignedTo) return;

            if (!techStatsMap.has(wo.assignedToId)) {
                techStatsMap.set(wo.assignedToId, {
                    name: wo.assignedTo.fullName,
                    total: 0,
                    totalResponseMinutes: 0,
                    totalResolutionMinutes: 0,
                });
            }

            const stats = techStatsMap.get(wo.assignedToId)!;
            stats.total++;

            if (wo.startedAt) {
                stats.totalResponseMinutes += diffMinutes(new Date(wo.startedAt), new Date(wo.createdAt));
            }
            if (wo.startedAt && wo.completedAt) {
                stats.totalResolutionMinutes += diffMinutes(new Date(wo.completedAt), new Date(wo.startedAt));
            }
        });

        const technicianStats = Array.from(techStatsMap.values()).map(s => ({
            name: s.name,
            totalTasks: s.total,
            avgResponseTime: s.total / (s.total || 1) > 0 ? (s.totalResponseMinutes / s.total).toFixed(0) : 0,
            avgResolutionTime: s.total / (s.total || 1) > 0 ? (s.totalResolutionMinutes / s.total).toFixed(0) : 0,
        }));


        // --- Admin Stats ---
        // 1. Dispatch Time (Ticket -> WO)
        const adminWhere: any = {
            createdById: { not: null },
            ticketId: { not: null },
        };
        if (startDate) adminWhere.createdAt = { gte: startDate };
        if (endDate) adminWhere.createdAt = { ...adminWhere.createdAt, lte: endDate };

        const adminWorkOrders = await prisma.workOrder.findMany({
            where: adminWhere,
            include: { createdBy: true, ticket: true },
        });

        const adminStatsMap = new Map<string, {
            name: string;
            totalCreated: number;
            totalDispatchMinutes: number;
            totalSupportResponses: number;
            totalSupportResponseMinutes: number;
        }>();

        adminWorkOrders.forEach(wo => {
            if (!wo.createdById || !wo.createdBy) return;

            if (!adminStatsMap.has(wo.createdById)) {
                adminStatsMap.set(wo.createdById, {
                    name: wo.createdBy.fullName,
                    totalCreated: 0,
                    totalDispatchMinutes: 0,
                    totalSupportResponses: 0,
                    totalSupportResponseMinutes: 0,
                });
            }

            const stats = adminStatsMap.get(wo.createdById)!;
            stats.totalCreated++;

            if (wo.ticket) {
                const diff = diffMinutes(new Date(wo.createdAt), new Date(wo.ticket.createdAt));
                if (diff > 0) stats.totalDispatchMinutes += diff;
            }
        });

        // 2. Support Response Time (Comment -> Comment)
        // We need updates of type COMMENT
        const commentUpdates = await prisma.workOrderUpdate.findMany({
            where: {
                updateType: 'COMMENT',
                createdAt: startDate && endDate ? { gte: startDate, lte: endDate } : undefined,
            },
            include: { createdBy: true },
            orderBy: { createdAt: 'asc' }
        });

        // Group comments by Work Order to analyze sequences
        const updatesByWO = new Map<string, typeof commentUpdates>();
        commentUpdates.forEach(u => {
            if (!updatesByWO.has(u.workOrderId)) updatesByWO.set(u.workOrderId, []);
            updatesByWO.get(u.workOrderId)!.push(u);
        });

        updatesByWO.forEach(updates => {
            for (let i = 0; i < updates.length - 1; i++) {
                const current = updates[i];
                const next = updates[i + 1];

                // Assuming Admin (creator) responding to Technician
                // Note: We need a way to distinguish role here. simpler check:
                // If current user != next user, and next user is an Admin (or the creator).

                // For this KPI, let's look for: Tech Comment -> Admin Reply.
                // We'll approximate 'Admin' as the person who created the WO (if known) or check roles (harder without querying).
                // Simplified: Identify 'Reply' speed regardless of role, attributed to the 'Responder' (next.createdById).

                if (current.createdById !== next.createdById && next.createdById) {
                    if (!adminStatsMap.has(next.createdById)) {
                        // Need name if not in map yet (might be an admin who hasn't created WOs in this range but replied)
                        const name = next.createdBy?.fullName || 'Unknown';
                        adminStatsMap.set(next.createdById, {
                            name,
                            totalCreated: 0,
                            totalDispatchMinutes: 0,
                            totalSupportResponses: 0,
                            totalSupportResponseMinutes: 0,
                        });
                    }
                    const stats = adminStatsMap.get(next.createdById)!;
                    stats.totalSupportResponses++;
                    stats.totalSupportResponseMinutes += diffMinutes(new Date(next.createdAt), new Date(current.createdAt));
                }
            }
        });

        const adminStats = Array.from(adminStatsMap.values()).map(s => ({
            name: s.name,
            totalCreated: s.totalCreated,
            avgDispatchTime: s.totalCreated > 0 ? (s.totalDispatchMinutes / s.totalCreated).toFixed(0) : 0,
            avgSupportResponseTime: s.totalSupportResponses > 0 ? (s.totalSupportResponseMinutes / s.totalSupportResponses).toFixed(0) : 0,
        }));

        return NextResponse.json({
            success: true,
            data: {
                technicianStats,
                adminStats,
            },
        });
    } catch (error) {
        console.error('Error calculating KPI stats:', error);
        return NextResponse.json({ error: 'Failed to calculate stats' }, { status: 500 });
    }
}
