export interface WorkOrderListSummarySource {
  status: string;
  type: string;
  title: string;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
  pelanggan?: {
    nama: string;
    noTelp?: string | null;
  } | null;
  contactName?: string | null;
  contactPhone?: string | null;
  site?: {
    name: string;
  } | null;
}

export interface TopWorkOrderCustomer {
  name: string;
  phone: string | null;
  count: number;
  siteName?: string | null;
}

export interface WorkOrderListSummary {
  completed: number;
  unfinished: number;
  focut: number;
  dismantle: number;
  averageCompletionTimeHours: number;
  topCustomers: TopWorkOrderCustomer[];
}

const COMPLETED_STATUSES = new Set(["COMPLETED", "VERIFIED", "CLOSED"]);
const IGNORED_UNFINISHED_STATUSES = new Set(["CANCELLED", "REJECTED"]);
const FOCUT_KEYWORDS = ["focut", "los", "mati"];
const DISMANTLE_KEYWORDS = [
  "dismantle",
  "dismental",
  "penarikan",
  "tarik",
  "cabut",
];
const TOP_CUSTOMER_LIMIT = 5;

export function buildWorkOrderListSummary(
  workOrders: WorkOrderListSummarySource[],
): WorkOrderListSummary {
  const summary = workOrders.reduce(
    (counts, workOrder) => {
      const durationHours = getCompletionDurationHours(workOrder);

      return {
        completed: counts.completed + Number(isCompleted(workOrder.status)),
        unfinished: counts.unfinished + Number(isUnfinished(workOrder.status)),
        focut:
          counts.focut + Number(hasKeyword(workOrder.title, FOCUT_KEYWORDS)),
        dismantle: counts.dismantle + Number(isDismantle(workOrder)),
        completionHoursTotal: counts.completionHoursTotal + durationHours,
        completionHoursCount:
          counts.completionHoursCount + Number(durationHours > 0),
      };
    },
    {
      completed: 0,
      unfinished: 0,
      focut: 0,
      dismantle: 0,
      completionHoursTotal: 0,
      completionHoursCount: 0,
    },
  );

  return {
    completed: summary.completed,
    unfinished: summary.unfinished,
    focut: summary.focut,
    dismantle: summary.dismantle,
    averageCompletionTimeHours: getAverageHours(summary),
    topCustomers: getTopCustomers(workOrders),
  };
}

function getTopCustomers(
  workOrders: WorkOrderListSummarySource[],
): TopWorkOrderCustomer[] {
  const customerCounts = new Map<string, TopWorkOrderCustomer>();

  for (const workOrder of workOrders) {
    const customer = getWorkOrderCustomer(workOrder);
    if (!customer) continue;

    const existingCustomer = customerCounts.get(customer.name);
    customerCounts.set(customer.name, {
      name: customer.name,
      phone: customer.phone,
      count: (existingCustomer?.count ?? 0) + 1,
      siteName: existingCustomer?.siteName ?? getSiteName(workOrder),
    });
  }

  return [...customerCounts.values()]
    .sort(
      (left, right) =>
        right.count - left.count || left.name.localeCompare(right.name),
    )
    .slice(0, TOP_CUSTOMER_LIMIT);
}

function getSiteName(workOrder: WorkOrderListSummarySource) {
  return workOrder.site?.name.trim() || null;
}

function getWorkOrderCustomer(
  workOrder: WorkOrderListSummarySource,
): { name: string; phone: string } | null {
  if (workOrder.pelanggan) {
    return getNamedCustomer(
      workOrder.pelanggan.nama,
      workOrder.pelanggan.noTelp,
    );
  }

  return getNamedCustomer(workOrder.contactName, workOrder.contactPhone);
}

function getNamedCustomer(
  name: string | null | undefined,
  phone: string | null | undefined,
) {
  const customerName = name?.trim();
  const customerPhone = phone?.trim();

  if (!customerName || !customerPhone) return null;
  return { name: customerName, phone: customerPhone };
}

function getAverageHours(summary: {
  completionHoursTotal: number;
  completionHoursCount: number;
}) {
  if (summary.completionHoursCount === 0) return 0;
  return summary.completionHoursTotal / summary.completionHoursCount;
}

function getCompletionDurationHours(workOrder: WorkOrderListSummarySource) {
  if (!workOrder.startedAt || !workOrder.completedAt) return 0;

  const startedAt = new Date(workOrder.startedAt).getTime();
  const completedAt = new Date(workOrder.completedAt).getTime();
  const durationMs = completedAt - startedAt;

  if (!Number.isFinite(durationMs) || durationMs <= 0) return 0;
  return durationMs / 3_600_000;
}

function isCompleted(status: string) {
  return COMPLETED_STATUSES.has(status);
}

function isUnfinished(status: string) {
  return !isCompleted(status) && !IGNORED_UNFINISHED_STATUSES.has(status);
}

function isDismantle(workOrder: WorkOrderListSummarySource) {
  return (
    workOrder.type === "DISCONNECTION" ||
    hasKeyword(workOrder.title, DISMANTLE_KEYWORDS)
  );
}

function hasKeyword(value: string, keywords: string[]) {
  const normalizedValue = value.toLowerCase();
  return keywords.some((keyword) => normalizedValue.includes(keyword));
}
