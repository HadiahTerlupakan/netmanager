import { Prisma, type PrismaClient } from "@prisma/client";

/**
 * Helper to classify work order based on title
 */
function classifyIssue(title: string): string {
  const lowerTitle = title.toLowerCase();
  if (
    lowerTitle.includes("mati") ||
    lowerTitle.includes("focut") ||
    lowerTitle.includes("los") ||
    lowerTitle.includes("merah")
  ) {
    return "Internet Mati / FOCUT";
  }
  if (
    lowerTitle.includes("lambat") ||
    lowerTitle.includes("lemot") ||
    lowerTitle.includes("slow") ||
    lowerTitle.includes("lag")
  ) {
    return "Koneksi Lambat";
  }
  if (
    lowerTitle.includes("tarik") ||
    lowerTitle.includes("ambil") ||
    lowerTitle.includes("dismantle") ||
    lowerTitle.includes("cabut")
  ) {
    return "Penarikan Perangkat";
  }
  if (
    lowerTitle.includes("pasang baru") ||
    lowerTitle.includes("psb") ||
    lowerTitle.includes("install")
  ) {
    return "Pasang Baru";
  }
  if (
    lowerTitle.includes("relokasi") ||
    lowerTitle.includes("pindah") ||
    lowerTitle.includes("geser")
  ) {
    return "Relokasi Perangkat";
  }
  return "Other";
}
/**
 * Get statistics on most common issues (based on Title keywords)
 */
export async function getIssueStatistics(
  prisma: PrismaClient,
  limit: number = 5,
  dateFrom?: Date,
  dateTo?: Date,
  departmentId?: string,
  siteId?: string,
): Promise<Array<{ issue: string; count: number }>> {
  const where: Prisma.WorkOrdersWhereInput = {};
  if (siteId) {
    where.siteId = siteId;
  }
  if (departmentId) {
    where.departmentId = departmentId;
  }
  if (dateFrom || dateTo) {
    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (dateFrom) createdAtFilter.gte = dateFrom;
    if (dateTo) createdAtFilter.lte = dateTo;
    where.createdAt = createdAtFilter;
  }
  // Fetch all work orders for the period
  const workOrders = await prisma.workOrders.findMany({
    where,
    select: { title: true },
  });
  // Categorize and count
  const counts: Record<string, number> = {
    "Internet Mati / FOCUT": 0,
    "Koneksi Lambat": 0,
    "Penarikan Perangkat": 0,
    "Pasang Baru": 0,
    "Relokasi Perangkat": 0,
    Other: 0,
  };
  workOrders.forEach((wo) => {
    const category = classifyIssue(wo.title);
    if (category in counts) {
      const currentCount = counts[category];
      if (typeof currentCount === "number") {
        counts[category] = currentCount + 1;
      }
    }
  });
  // Convert to array and sort
  return Object.entries(counts)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([issue, count]) => ({ issue, count }));
}
/**
 * Get statistics on sites with most work orders and their most common issue
 */
export async function getSiteStatistics(
  prisma: PrismaClient,
  limit: number = 5,
  dateFrom?: Date,
  dateTo?: Date,
  departmentId?: string,
  siteId?: string,
): Promise<
  Array<{ siteName: string; count: number; mostCommonIssue: string }>
> {
  const where: Prisma.WorkOrdersWhereInput = {};
  if (siteId) {
    where.siteId = siteId;
  }
  if (departmentId) {
    where.departmentId = departmentId;
  }
  if (dateFrom || dateTo) {
    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (dateFrom) createdAtFilter.gte = dateFrom;
    if (dateTo) createdAtFilter.lte = dateTo;
    where.createdAt = createdAtFilter;
  }
  // 1. Find top sites (Group by pelangganId)
  const topSites = await prisma.workOrders.groupBy({
    by: ["pelangganId"],
    where: {
      ...where,
      pelangganId: { not: null },
    },
    _count: {
      pelangganId: true,
    },
    orderBy: {
      _count: {
        pelangganId: "desc",
      },
    },
    take: limit,
  });
  const results = await Promise.all(
    topSites.map(async (site) => {
      if (!site.pelangganId) return null;
      const pelanggan = await prisma.pelanggan.findUnique({
        where: { id: site.pelangganId },
        select: { nama: true },
      });
      // 2. Fetch all work orders for this site within the period
      const siteWorkOrders = await prisma.workOrders.findMany({
        where: {
          ...where,
          pelangganId: site.pelangganId,
        },
        select: { title: true },
      });
      // 3. Find most common issue for this site
      const issueCounts: Record<string, number> = {};
      siteWorkOrders.forEach((wo) => {
        const category = classifyIssue(wo.title);
        issueCounts[category] = (issueCounts[category] || 0) + 1;
      });
      const mostCommonIssue = Object.entries(issueCounts).sort(
        (a, b) => b[1] - a[1],
      )[0];
      return {
        siteName: pelanggan?.nama || "Unknown Site",
        count: site._count.pelangganId,
        mostCommonIssue: mostCommonIssue ? mostCommonIssue[0] : "N/A",
      };
    }),
  );
  return results.filter(
    (r): r is { siteName: string; count: number; mostCommonIssue: string } =>
      r !== null,
  );
}
/**
 * Get statistics on disconnection reasons
 */
export async function getDisconnectionStatistics(
  prisma: PrismaClient,
  dateFrom?: Date,
  dateTo?: Date,
  departmentId?: string,
  siteId?: string,
): Promise<Array<{ reason: string; count: number }>> {
  const where: Prisma.WorkOrdersWhereInput = {
    type: "DISCONNECTION",
    // Include all completed states, not just COMPLETED
    status: { in: ["COMPLETED", "VERIFIED", "CLOSED"] },
  };
  if (siteId) where.siteId = siteId;
  if (departmentId) where.departmentId = departmentId;
  // Use createdAt for date filtering (more reliable than completedAt which might be null)
  if (dateFrom || dateTo) {
    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (dateFrom) createdAtFilter.gte = dateFrom;
    if (dateTo) createdAtFilter.lte = dateTo;
    where.createdAt = createdAtFilter;
  }
  const groupBy = await prisma.workOrders.groupBy({
    by: ["disconnectionReason"],
    where: {
      ...where,
      disconnectionReason: { not: null },
    },
    _count: {
      _all: true,
    },
  });
  return groupBy
    .map((item) => ({
      reason: item.disconnectionReason!,
      count: item._count._all,
    }))
    .sort((a, b) => b.count - a.count); // Sort by count descending
}
