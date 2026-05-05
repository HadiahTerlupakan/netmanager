import { formatInTimeZone } from "date-fns-tz";
import { toStartOfDay } from "@/lib/utils/server-datetime";
import { getTimezoneSync } from "@/lib/utils/get-timezone";

const MIXRADIUS_FETCH_LENGTH = 100000;

export interface MobileDashboardPeriods {
  today: Date;
  weekStart: Date;
  monthStart: Date;
}

export interface MobileDashboardMixRadiusService {
  fetchIncomeByPeriod(input: {
    startDate: string;
    endDate: string;
    length: number;
  }): Promise<{
    data?: Array<{ owner_name?: string; member_id?: string; invoice: string }>;
  } | null>;
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

/** Calculate fee pelanggan stats from MixRadius income data. */
export async function getMitraFeePelangganStats(
  mixRadiusService: MobileDashboardMixRadiusService,
  input: {
    monthStart: Date;
    today: Date;
    ownerNames: string[];
    feeRate: number;
    tenantId: string;
  },
) {
  try {
    const timezone = getTimezoneSync(input.tenantId);
    const startDate = formatInTimeZone(
      input.monthStart,
      timezone,
      "yyyy-MM-dd",
    );
    const endDate = formatInTimeZone(input.today, timezone, "yyyy-MM-dd");
    const incomeResult = await mixRadiusService.fetchIncomeByPeriod({
      startDate,
      endDate,
      length: MIXRADIUS_FETCH_LENGTH,
    });

    if (!incomeResult?.data?.length) {
      return { activeCustomers: 0, totalFeePelanggan: 0 };
    }

    const allowedOwners = buildAllowedOwnerSet(input.ownerNames);
    const filteredData = incomeResult.data.filter((item) =>
      isAllowedOwner(item.owner_name, allowedOwners),
    );
    const uniqueMembers = new Set<string>();

    filteredData.forEach((record) => {
      const identifier =
        record.member_id === "0" || !record.member_id
          ? record.invoice
          : record.member_id;

      if (identifier) {
        uniqueMembers.add(identifier);
      }
    });

    const activeCustomers = uniqueMembers.size;
    return {
      activeCustomers,
      totalFeePelanggan: activeCustomers * input.feeRate,
    };
  } catch {
    return { activeCustomers: 0, totalFeePelanggan: 0 };
  }
}

function buildAllowedOwnerSet(ownerNames: string[]) {
  const allowedOwners = new Set<string>();

  ownerNames.forEach((ownerName) => {
    const normalized = ownerName.toLowerCase().trim();
    allowedOwners.add(normalized);
    allowedOwners.add(normalized.split(/[—–-]/)[0]?.trim() || normalized);
  });

  return allowedOwners;
}

function isAllowedOwner(
  ownerName: string | undefined,
  allowedOwners: Set<string>,
) {
  if (allowedOwners.size === 0) {
    return true;
  }

  if (!ownerName) {
    return false;
  }

  const normalized = ownerName.toLowerCase().trim();
  const prefix = normalized.split(/[—–-]/)[0]?.trim() || normalized;
  return allowedOwners.has(normalized) || allowedOwners.has(prefix);
}
