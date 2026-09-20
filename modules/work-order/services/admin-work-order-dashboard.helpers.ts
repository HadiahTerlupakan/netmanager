import { isSuperAdmin } from "@/lib/auth";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const LAST_30_DAYS = 30;
const END_OF_DAY = { hours: 23, minutes: 59, seconds: 59, ms: 999 };

type DashboardAccessFilterOptions = {
  role?: string;
  isSuperAdmin?: boolean;
  permissions?: string[];
  departmentId?: string | null;
  siteId?: string | null;
};

type DashboardAccessFilters = {
  departmentId?: string;
  siteId?: string;
  emptyResponse: boolean;
};

export function buildDashboardDateRange(period: string): {
  dateFrom?: Date;
  dateTo?: Date;
} {
  const now = new Date();
  if (period === "daily")
    return { dateFrom: startOfDay(now), dateTo: new Date() };
  if (period === "weekly")
    return { dateFrom: startOfWeek(now), dateTo: new Date() };
  if (period === "monthly")
    return { dateFrom: startOfMonth(now), dateTo: new Date() };
  if (period === "yearly")
    return { dateFrom: startOfYear(now), dateTo: new Date() };
  if (period === "last_30_days")
    return { dateFrom: last30Days(), dateTo: new Date() };
  return {};
}

export function buildAnalyticsDateRange(period: string): {
  dateFrom?: Date;
  dateTo?: Date;
} {
  const now = new Date();
  if (period === "daily")
    return { dateFrom: startOfDay(now), dateTo: endOfDay(now) };
  if (period === "weekly")
    return { dateFrom: startOfWeek(now), dateTo: new Date() };
  if (period === "monthly")
    return { dateFrom: startOfMonth(now), dateTo: new Date() };
  if (period === "yearly")
    return { dateFrom: startOfYear(now), dateTo: new Date() };
  return {};
}

export function buildWorkOrderDashboardAccessFilters(
  options: DashboardAccessFilterOptions,
): DashboardAccessFilters {
  const isSuper = isDashboardSuperAdmin(options);
  const departmentId = resolveDashboardDepartmentFilter(options, isSuper);
  const siteId = resolveDashboardSiteFilter(options, isSuper);

  return {
    ...(departmentId.value ? { departmentId: departmentId.value } : {}),
    ...(siteId.value ? { siteId: siteId.value } : {}),
    emptyResponse: departmentId.isEmpty || siteId.isEmpty,
  };
}

function isDashboardSuperAdmin(options: DashboardAccessFilterOptions) {
  return isSuperAdmin({
    role: options.role,
    isSuperAdmin: options.isSuperAdmin,
  });
}

/**
 * Dashboard ini dijaga permission `work_order_dashboard:*`, jadi pembatasannya
 * wajib membaca nama itu. Nama `workorders:*` tetap diterima karena isinya data
 * work order: role yang dibatasi pada work order wajar ikut dibatasi di sini.
 *
 * Nama permission ditulis sebagai literal utuh — bukan dirakit dari template —
 * supaya bisa ditemukan lewat pencarian teks, termasuk oleh penjaga
 * `tests/architecture/site-restriction-capability-catalog.test.ts`.
 */
const SCOPE_PERMISSIONS = {
  site_only: ["work_order_dashboard:site_only", "workorders:site_only"],
  department_only: [
    "work_order_dashboard:department_only",
    "workorders:department_only",
  ],
} as const;

function hasScopeRestriction(
  permissions: string[] | undefined,
  scope: keyof typeof SCOPE_PERMISSIONS,
): boolean {
  const diterima: readonly string[] = SCOPE_PERMISSIONS[scope];
  return (
    permissions?.some((permission) => diterima.includes(permission)) ?? false
  );
}

function resolveDashboardDepartmentFilter(
  options: DashboardAccessFilterOptions,
  isSuper: boolean,
) {
  return resolveRestrictedValue({
    isRestricted: hasScopeRestriction(options.permissions, "department_only"),
    isSuper,
    value: options.departmentId,
  });
}

function resolveDashboardSiteFilter(
  options: DashboardAccessFilterOptions,
  isSuper: boolean,
) {
  return resolveRestrictedValue({
    isRestricted: hasScopeRestriction(options.permissions, "site_only"),
    isSuper,
    value: options.siteId,
  });
}

export function getEmptyWorkOrderDashboardData() {
  return {
    stats: createEmptyStats(),
    recentWorkOrders: [] as unknown[],
    departmentWorkload: [] as unknown[],
    topPerformers: [] as unknown[],
    topAssists: [] as unknown[],
    issueStats: [] as unknown[],
    siteStats: [] as unknown[],
    disconnectionStats: [] as unknown[],
    responseStats: [] as unknown[],
    adminKPI: createEmptyAdminKpi(),
    woTypeStats: { customer: 0, internal: 0 },
  };
}

function resolveRestrictedValue(input: {
  isRestricted?: boolean;
  isSuper: boolean;
  value?: string | null;
}) {
  if (!input.isRestricted || input.isSuper) return { value: undefined };
  if (!input.value) return { isEmpty: true };
  return { value: input.value };
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    END_OF_DAY.hours,
    END_OF_DAY.minutes,
    END_OF_DAY.seconds,
    END_OF_DAY.ms,
  );
}

function startOfWeek(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() - date.getDay(),
  );
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function last30Days() {
  return new Date(Date.now() - LAST_30_DAYS * DAY_IN_MS);
}

function createEmptyStats() {
  return {
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
    totalWithRating: 0,
  };
}

function createEmptyAdminKpi() {
  return {
    pendingVerification: 0,
    avgVerificationTimeMinutes: 0,
    avgOnHoldResponseMinutes: 0,
    verifiedToday: 0,
    verifiedThisWeek: 0,
  };
}
