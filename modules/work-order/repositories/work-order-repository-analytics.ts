import { Prisma, type PrismaClient } from "@prisma/client";
import { toStartOfDay } from "@/lib/utils/server-datetime";

function classifyIssue(title: string): string {
  const lowerTitle = title.toLowerCase();
  if (
    lowerTitle.includes("los") ||
    lowerTitle.includes("redaman") ||
    lowerTitle.includes("signal")
  )
    return "LOS/Redaman";
  if (
    lowerTitle.includes("lambat") ||
    lowerTitle.includes("slow") ||
    lowerTitle.includes("speed")
  )
    return "Internet Lambat";
  if (
    lowerTitle.includes("putus") ||
    lowerTitle.includes("disconnect") ||
    lowerTitle.includes("dc")
  )
    return "Koneksi Putus";
  if (
    lowerTitle.includes("router") ||
    lowerTitle.includes("modem") ||
    lowerTitle.includes("onu")
  )
    return "Perangkat";
  if (
    lowerTitle.includes("tagihan") ||
    lowerTitle.includes("billing") ||
    lowerTitle.includes("payment")
  )
    return "Billing";
  if (lowerTitle.includes("install") || lowerTitle.includes("pasang"))
    return "Instalasi";
  return "Lainnya";
}

export async function getAdminResponseStats(
  prisma: PrismaClient,
  dateFrom: Date,
  dateTo: Date,
  departmentId?: string,
): Promise<
  Array<{
    userId: string;
    userName: string;
    role: string;
    totalScore: number;
    totalResponses: number;
    avgResponseTimeMinutes: number;
    verifiedCount: number;
    avgVerifyTimeMinutes: number;
    completedCount: number;
    canvasingCount: number;
    avgCanvasingTimeMinutes: number;
  }>
> {
  const where: Prisma.WorkOrderUpdatesWhereInput = {
    createdAt: { gte: dateFrom, lte: dateTo },
    createdById: { not: null },
  };
  // 1. Get all updates in range with user info
  const updates = await prisma.workOrderUpdates.findMany({
    where,
    include: {
      workOrders: {
        select: {
          id: true,
          createdAt: true,
          completedAt: true,
          verifiedAt: true,
          departmentId: true,
          status: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          role: {
            select: {
              name: true,
              isTechnical: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  // Stats structure per user
  interface UserKPIStats {
    name: string;
    role: string;
    // Response time
    totalResponseTime: number;
    responseCount: number;
    // Verification
    verifiedCount: number;
    totalVerifyTime: number;
    // Completed as lead
    completedCount: number;
    // Canvasing Approval
    canvasingCount?: number;
    totalCanvasingTime?: number;
    isTechnical?: boolean;
  }
  const userStats: Record<string, UserKPIStats> = {};
  const processedResponsePairs = new Set<string>();
  const processedVerifyPairs = new Set<string>();
  // const processedOnHoldPairs = new Set<string>(); // Removed unused variable
  // Track ON_HOLD events for matching
  const onHoldEvents: Record<string, { createdAt: Date }> = {};
  updates.forEach((update) => {
    if (!update.user || !update.createdById) return;
    if (departmentId && update.workOrders.departmentId !== departmentId) return;
    const userId = update.createdById;
    // Initialize user stats
    if (!userStats[userId]) {
      userStats[userId] = {
        name: update.user.name || "Unknown",
        role: update.user.role?.name || "N/A",
        isTechnical: update.user.role?.isTechnical || false,
        totalResponseTime: 0,
        responseCount: 0,
        verifiedCount: 0,
        totalVerifyTime: 0,
        completedCount: 0,
      };
    }
    // Track ON_HOLD events
    if (update.newStatus === "ON_HOLD") {
      onHoldEvents[update.workOrderId] = { createdAt: update.createdAt };
    }
    // 1. Response Time (first action per WO)
    const responseKey = `response-${update.workOrderId}-${userId}`;
    // Fix: Count ANY user response (Admin or Tech)
    if (!processedResponsePairs.has(responseKey)) {
      const responseTimeMinutes =
        (new Date(update.createdAt).getTime() -
          new Date(update.workOrders.createdAt).getTime()) /
        (1000 * 60);
      if (responseTimeMinutes >= 0) {
        userStats[userId].totalResponseTime += responseTimeMinutes;
        userStats[userId].responseCount += 1;
        processedResponsePairs.add(responseKey);
      }
    }
    // 2. Verification - user melakukan verify
    if (update.newStatus === "VERIFIED") {
      const verifyKey = `verify-${update.workOrderId}`;
      if (!processedVerifyPairs.has(verifyKey)) {
        userStats[userId].verifiedCount += 1;
        // Calculate verify time
        if (update.workOrders.completedAt) {
          const verifyTime =
            (new Date(update.createdAt).getTime() -
              new Date(update.workOrders.completedAt).getTime()) /
            (1000 * 60);
          if (verifyTime >= 0) {
            userStats[userId].totalVerifyTime += verifyTime;
          }
        }
        processedVerifyPairs.add(verifyKey);
      }
    }
    // 4. Completed Count - technician completed WO
    if (update.newStatus === "COMPLETED" && update.user.role?.isTechnical) {
      userStats[userId].completedCount += 1;
    }
  });
  // 5. Canvasing Approval (Sales)
  // Only count APPROVED canvasing within range
  const canvasingApprovals = await prisma.canvasing.findMany({
    where: {
      approvedAt: { gte: dateFrom, lte: dateTo },
      approvedBy: { not: null },
    },
    select: {
      approvedBy: true,
      approvedAt: true,
      createdAt: true,
    },
  });
  canvasingApprovals.forEach((canvas) => {
    if (!canvas.approvedBy || !canvas.approvedAt) return;
    const userId = canvas.approvedBy;
    // Initialize user stats if not exists (might happen if user only did canvasing approval)
    if (!userStats[userId]) {
      // Warning: We might not have name/role if they didn't appear in WO updates
      // For MVP, we'll try to fetch it or default it.
      // Since this is robust code, ideally we fetch user details if missing.
      // But for now, let's assume active admins appear in both or we accept 'Unknown' for pure Sales admins
      // To be safe, let's fetch user details if missing in a later step if needed, or just rely on existing structure.
      // For now, let's add them with default values, and maybe doing a separate user fetch for missing names is better if we want perfection.
      // However, most admins doing approvals are likely the same admins.
      userStats[userId] = {
        name: "Admin (Sales)", // Placeholder if unknown
        role: "N/A",
        totalResponseTime: 0,
        responseCount: 0,
        verifiedCount: 0,
        totalVerifyTime: 0,
        completedCount: 0,
        canvasingCount: 0,
        totalCanvasingTime: 0,
      };
    } else {
      // Ensure new fields exist for existing users
      if (userStats[userId].canvasingCount === undefined) {
        userStats[userId].canvasingCount = 0;
        userStats[userId].totalCanvasingTime = 0;
      }
    }
    const approveTime =
      (new Date(canvas.approvedAt).getTime() -
        new Date(canvas.createdAt).getTime()) /
      (1000 * 60);
    if (approveTime >= 0) {
      userStats[userId].canvasingCount =
        (userStats[userId].canvasingCount || 0) + 1;
      userStats[userId].totalCanvasingTime =
        (userStats[userId].totalCanvasingTime || 0) + approveTime;
    }
  });
  // If we have users with only Canvasing stats (name='Admin (Sales)'), we should try to fetch their real names
  const unknownUserIds = Object.keys(userStats).filter((uid) => {
    const stat = userStats[uid];
    return stat && stat.name === "Admin (Sales)";
  });
  if (unknownUserIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: unknownUserIds } },
      select: { id: true, name: true, role: { select: { name: true } } },
    });
    users.forEach((u) => {
      const stat = userStats[u.id];
      if (stat) {
        stat.name = u.name || "Unknown";
        stat.role = u.role?.name || "N/A";
      }
    });
  }
  return Object.entries(userStats)
    .map(([userId, stat]) => {
      // Scoring System (Weighted Points)
      // Completed (Tech) = 5 pts
      // Verified (Admin Final) = 3 pts
      // Canvasing Approval (Admin Task) = 2 pts
      // Regular Response (Quick Action) = 1 pt
      const score =
        stat.completedCount * 5 +
        stat.verifiedCount * 3 +
        (stat.canvasingCount || 0) * 2 +
        stat.responseCount * 1;
      return {
        userId,
        userName: stat.name,
        role: stat.role,
        isTechnical: stat.isTechnical || false,
        totalScore: score,
        totalResponses: stat.responseCount,
        avgResponseTimeMinutes:
          stat.responseCount > 0
            ? Math.round(stat.totalResponseTime / stat.responseCount)
            : 0,
        verifiedCount: stat.verifiedCount,
        avgVerifyTimeMinutes:
          stat.verifiedCount > 0
            ? Math.round(stat.totalVerifyTime / stat.verifiedCount)
            : 0,
        completedCount: stat.completedCount,
        canvasingCount: stat.canvasingCount || 0,
        avgCanvasingTimeMinutes:
          (stat.canvasingCount || 0) > 0
            ? Math.round(
                (stat.totalCanvasingTime || 0) / (stat.canvasingCount || 0),
              )
            : 0,
      };
    })
    .filter((stat) => stat.totalScore > 0)
    .sort((a, b) => b.totalScore - a.totalScore); // Sort by Score instead of response time
}
/**
 * Get Admin KPI Statistics
 * Calculates metrics for admin performance in Work Order management
 */
export async function getAdminKPIStats(
  prisma: PrismaClient,
  departmentId?: string,
  siteId?: string,
): Promise<{
  pendingVerification: number;
  avgVerificationTimeMinutes: number;
  avgCanvasingTimeMinutes: number;
  canvasingApprovedToday: number;
  canvasingApprovedThisWeek: number;
}> {
  const today = new Date();
  today.setTime(toStartOfDay(today).getTime());
  const dateTo = new Date();
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - 30);
  const where: Record<string, unknown> = {};
  if (departmentId) where.departmentId = departmentId;
  if (siteId) where.siteId = siteId;
  // 1. Pending Verification - WO yang status COMPLETED tapi belum di-verify
  const pendingVerification = await prisma.workOrders.count({
    where: {
      ...where,
      status: "COMPLETED",
    },
  });
  // 2. Avg Verification Time - waktu dari COMPLETED ke VERIFIED
  const verifiedWOs = await prisma.workOrders.findMany({
    where: {
      ...where,
      status: { in: ["VERIFIED", "CLOSED"] },
      completedAt: { not: null },
      verifiedAt: { not: null },
    },
    select: {
      completedAt: true,
      verifiedAt: true,
    },
  });
  let totalVerificationMinutes = 0;
  verifiedWOs.forEach((wo) => {
    if (wo.completedAt && wo.verifiedAt) {
      const diff =
        new Date(wo.verifiedAt).getTime() - new Date(wo.completedAt).getTime();
      totalVerificationMinutes += diff / (1000 * 60);
    }
  });
  const avgVerificationTimeMinutes =
    verifiedWOs.length > 0
      ? Math.round(totalVerificationMinutes / verifiedWOs.length)
      : 0;
  // 3. Global Canvasing Stats (Sales)
  const approvedCanvasing = await prisma.canvasing.findMany({
    where: {
      approvedAt: { not: null },
      createdAt: { gte: dateFrom, lte: dateTo },
    },
    select: { createdAt: true, approvedAt: true },
  });
  let totalCanvasingMinutes = 0;
  approvedCanvasing.forEach((c) => {
    if (c.approvedAt) {
      const diff =
        new Date(c.approvedAt).getTime() - new Date(c.createdAt).getTime();
      totalCanvasingMinutes += diff / (1000 * 60);
    }
  });
  const avgCanvasingTimeMinutes =
    approvedCanvasing.length > 0
      ? Math.round(totalCanvasingMinutes / approvedCanvasing.length)
      : 0;
  // Canvasing Approved Today
  const canvasingApprovedToday = await prisma.canvasing.count({
    where: {
      approvedAt: { gte: today },
    },
  });
  // 4. Canvasing Approved Today & This Week (Sales)
  const startOfWeek = new Date(today);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const [canvasingApprovedThisWeek] = await Promise.all([
    prisma.canvasing.count({
      where: {
        approvedAt: { gte: startOfWeek },
      },
    }),
  ]);
  return {
    pendingVerification,
    avgVerificationTimeMinutes,
    avgCanvasingTimeMinutes,
    canvasingApprovedToday,
    canvasingApprovedThisWeek,
  };
}
// ==================== TREND ANALYTICS METHODS ====================
/**
 * Get Volume Trend - WO Created vs Completed vs Requested per month
 * Used for dashboard trend chart
 */
export async function getVolumeTrend(
  prisma: PrismaClient,
  startDate: Date,
  endDate: Date,
  departmentId?: string,
  siteId?: string,
): Promise<
  Array<{
    month: string;
    created: number;
    completed: number;
    requested: number;
  }>
> {
  const where: Record<string, unknown> = {};
  if (departmentId) where.departmentId = departmentId;
  if (siteId) where.siteId = siteId;
  // Get all WOs in date range
  const [createdWOs, completedWOs, requestedWOs] = await Promise.all([
    prisma.workOrders.findMany({
      where: {
        ...where,
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { createdAt: true },
    }),
    prisma.workOrders.findMany({
      where: {
        ...where,
        completedAt: { gte: startDate, lte: endDate },
        status: { in: ["COMPLETED", "VERIFIED", "CLOSED"] },
      },
      select: { completedAt: true },
    }),
    prisma.workOrders.findMany({
      where: {
        ...where,
        status: "REQUESTED",
        requestedAt: { gte: startDate, lte: endDate },
      },
      select: { requestedAt: true },
    }),
  ]);
  // Build month map
  const months: {
    [key: string]: { created: number; completed: number; requested: number };
  } = {};
  const monthsDiff =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth()) +
    1;
  const numMonths = Math.max(1, Math.min(monthsDiff, 24));
  for (let i = 0; i < numMonths; i++) {
    const date = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    months[key] = { created: 0, completed: 0, requested: 0 };
  }
  // Aggregate created
  createdWOs.forEach((wo) => {
    const date = new Date(wo.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (months[key]) months[key].created++;
  });
  // Aggregate completed
  completedWOs.forEach((wo) => {
    if (wo.completedAt) {
      const date = new Date(wo.completedAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (months[key]) months[key].completed++;
    }
  });
  // Aggregate requested
  requestedWOs.forEach((wo) => {
    if (wo.requestedAt) {
      const date = new Date(wo.requestedAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (months[key]) months[key].requested++;
    }
  });
  return Object.entries(months).map(([key, value]) => {
    const [year, month] = key.split("-");
    const date = new Date(parseInt(year || "0"), parseInt(month || "1") - 1, 1);
    return {
      month: date.toLocaleDateString("id-ID", {
        month: "short",
        year: "numeric",
      }),
      created: value.created,
      completed: value.completed,
      requested: value.requested,
    };
  });
}
/**
 * Get Issue Trend - Distribution of issues per month
 * Uses classifyIssue helper to categorize WOs
 */
export async function getIssueTrend(
  prisma: PrismaClient,
  startDate: Date,
  endDate: Date,
  departmentId?: string,
  siteId?: string,
): Promise<
  Array<{ month: string; issues: Array<{ issue: string; count: number }> }>
> {
  const where: Record<string, unknown> = {};
  if (departmentId) where.departmentId = departmentId;
  if (siteId) where.siteId = siteId;
  const workOrders = await prisma.workOrders.findMany({
    where: {
      ...where,
      createdAt: { gte: startDate, lte: endDate },
    },
    select: { title: true, createdAt: true },
  });
  // Build month-issue map
  const monthIssues: { [key: string]: { [issue: string]: number } } = {};
  const monthsDiff =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth()) +
    1;
  const numMonths = Math.max(1, Math.min(monthsDiff, 24));
  for (let i = 0; i < numMonths; i++) {
    const date = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthIssues[key] = {};
  }
  // Categorize each WO
  workOrders.forEach((wo) => {
    const date = new Date(wo.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (monthIssues[key]) {
      const issue = classifyIssue(wo.title);
      monthIssues[key][issue] = (monthIssues[key][issue] || 0) + 1;
    }
  });
  return Object.entries(monthIssues).map(([key, issueMap]) => {
    const [year, month] = key.split("-");
    const date = new Date(parseInt(year || "0"), parseInt(month || "1") - 1, 1);
    return {
      month: date.toLocaleDateString("id-ID", {
        month: "short",
        year: "numeric",
      }),
      issues: Object.entries(issueMap)
        .map(([issue, count]) => ({ issue, count }))
        .sort((a, b) => b.count - a.count),
    };
  });
}
/**
 * Get Performance Trend - Avg completion time and rating per month
 */
export async function getPerformanceTrend(
  prisma: PrismaClient,
  startDate: Date,
  endDate: Date,
  departmentId?: string,
  siteId?: string,
): Promise<
  Array<{
    month: string;
    avgCompletionHours: number;
    avgRating: number | null;
    totalCompleted: number;
  }>
> {
  const where: Record<string, unknown> = {};
  if (departmentId) where.departmentId = departmentId;
  if (siteId) where.siteId = siteId;
  const completedWOs = await prisma.workOrders.findMany({
    where: {
      ...where,
      completedAt: { gte: startDate, lte: endDate },
      status: { in: ["COMPLETED", "VERIFIED", "CLOSED"] },
    },
    select: {
      completedAt: true,
      startedAt: true,
      actualHours: true,
      rating: true,
    },
  });
  // Build month map
  const monthStats: {
    [key: string]: {
      totalHours: number;
      totalRating: number;
      ratingCount: number;
      count: number;
    };
  } = {};
  const monthsDiff =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth()) +
    1;
  const numMonths = Math.max(1, Math.min(monthsDiff, 24));
  for (let i = 0; i < numMonths; i++) {
    const date = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthStats[key] = {
      totalHours: 0,
      totalRating: 0,
      ratingCount: 0,
      count: 0,
    };
  }
  // Aggregate stats
  completedWOs.forEach((wo) => {
    if (wo.completedAt) {
      const date = new Date(wo.completedAt);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (monthStats[key]) {
        monthStats[key].count++;
        // Calculate completion hours
        if (wo.actualHours) {
          monthStats[key].totalHours += Number(wo.actualHours);
        } else if (wo.startedAt && wo.completedAt) {
          const hours =
            (new Date(wo.completedAt).getTime() -
              new Date(wo.startedAt).getTime()) /
            (1000 * 60 * 60);
          monthStats[key].totalHours += hours;
        }
        // Rating
        if (wo.rating) {
          monthStats[key].totalRating += Number(wo.rating);
          monthStats[key].ratingCount++;
        }
      }
    }
  });
  return Object.entries(monthStats).map(([key, stats]) => {
    const [year, month] = key.split("-");
    const date = new Date(parseInt(year || "0"), parseInt(month || "1") - 1, 1);
    return {
      month: date.toLocaleDateString("id-ID", {
        month: "short",
        year: "numeric",
      }),
      avgCompletionHours:
        stats.count > 0
          ? Math.round((stats.totalHours / stats.count) * 10) / 10
          : 0,
      avgRating:
        stats.ratingCount > 0
          ? Math.round((stats.totalRating / stats.ratingCount) * 10) / 10
          : null,
      totalCompleted: stats.count,
    };
  });
}
/**
 * Get Type Trend - Distribution of WO types per month
 */
export async function getTypeTrend(
  prisma: PrismaClient,
  startDate: Date,
  endDate: Date,
  departmentId?: string,
  siteId?: string,
): Promise<
  Array<{ month: string; types: Array<{ type: string; count: number }> }>
> {
  const where: Record<string, unknown> = {};
  if (departmentId) where.departmentId = departmentId;
  if (siteId) where.siteId = siteId;
  const workOrders = await prisma.workOrders.findMany({
    where: {
      ...where,
      createdAt: { gte: startDate, lte: endDate },
    },
    select: { type: true, createdAt: true },
  });
  // Build month-type map
  const monthTypes: { [key: string]: { [type: string]: number } } = {};
  const monthsDiff =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth()) +
    1;
  const numMonths = Math.max(1, Math.min(monthsDiff, 24));
  for (let i = 0; i < numMonths; i++) {
    const date = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    monthTypes[key] = {};
  }
  // Aggregate types
  workOrders.forEach((wo) => {
    const date = new Date(wo.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (monthTypes[key]) {
      const type = wo.type || "OTHER";
      monthTypes[key][type] = (monthTypes[key][type] || 0) + 1;
    }
  });
  // Type labels mapping
  const typeLabels: { [key: string]: string } = {
    INSTALLATION: "Pemasangan",
    REPAIR: "Perbaikan",
    MAINTENANCE: "Maintenance",
    INSPECTION: "Inspeksi",
    DISCONNECTION: "Cabut Perangkat",
    RELOCATION: "Relokasi",
    UPGRADE: "Upgrade",
    OTHER: "Lainnya",
  };
  return Object.entries(monthTypes).map(([key, typeMap]) => {
    const [year, month] = key.split("-");
    const date = new Date(parseInt(year || "0"), parseInt(month || "1") - 1, 1);
    return {
      month: date.toLocaleDateString("id-ID", {
        month: "short",
        year: "numeric",
      }),
      types: Object.entries(typeMap)
        .map(([type, count]) => ({ type: typeLabels[type] || type, count }))
        .sort((a, b) => b.count - a.count),
    };
  });
}
