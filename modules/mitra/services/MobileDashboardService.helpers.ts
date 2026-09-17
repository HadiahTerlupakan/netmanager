import { toStartOfDay } from "@/lib/utils/server-datetime";

export interface MobileDashboardPeriods {
  today: Date;
  weekStart: Date;
  monthStart: Date;
}

interface EmployeeCanvasingRepository {
  countAccumulatedCanvasing(input: {
    userId: string;
    tenantId: string;
    targetSchema: string;
    monthStart: Date;
  }): Promise<number>;
  countMonthlyCanvasing(input: {
    userId: string;
    tenantId: string;
    targetSchema: string;
    monthStart: Date;
  }): Promise<number>;
}

/** Build shared date boundaries for the mobile dashboard. */
export function createDashboardPeriods(): MobileDashboardPeriods {
  const now = new Date();
  const today = new Date(now);
  today.setTime(toStartOfDay(today).getTime());

  const weekStart = new Date(now);
  const dayOfWeek = weekStart.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  weekStart.setDate(weekStart.getDate() - diff);
  weekStart.setTime(toStartOfDay(weekStart).getTime());

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  monthStart.setTime(toStartOfDay(monthStart).getTime());

  return { today, weekStart, monthStart };
}

/** Extract effective site ids for an employee dashboard query. */
export function extractUserSiteIds(
  siteId: string | null,
  userSites: Array<{ siteId: string }>,
) {
  if (userSites.length > 0) {
    return userSites.map((userSite) => userSite.siteId);
  }

  return siteId ? [siteId] : [];
}

/** Resolve employee canvasing progress based on the configured schema. */
export async function getEmployeeCanvasingProgress(
  repository: EmployeeCanvasingRepository,
  input: {
    userId: string;
    tenantId: string;
    targetSchema: string;
    monthStart: Date;
  },
) {
  if (input.targetSchema === "ACCUMULATED") {
    return repository.countAccumulatedCanvasing(input);
  }

  return repository.countMonthlyCanvasing(input);
}
