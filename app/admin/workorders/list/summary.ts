import {
  buildWorkOrderListSummary,
  type TopWorkOrderCustomer,
  type WorkOrderListSummary,
  type WorkOrderListSummarySource,
} from "@/modules/work-order/client";

export type {
  TopWorkOrderCustomer,
  WorkOrderListSummary,
} from "@/modules/work-order/client";

export interface WorkOrderSummaryCard {
  id:
    | "completed"
    | "unfinished"
    | "focut"
    | "dismantle"
    | "averageCompletionTime";
  label: string;
  value: number | string;
  tone: "emerald" | "amber" | "sky" | "rose" | "indigo";
  description: string;
}

export function buildWorkOrderSummaryCards(
  workOrders: WorkOrderListSummarySource[],
): WorkOrderSummaryCard[] {
  return buildWorkOrderSummaryCardsFromCounts(
    buildWorkOrderListSummary(workOrders),
  );
}

export function buildTopCustomerSearchValue(customerName: string) {
  return customerName.trim();
}

export function buildVisibleTopCustomers(
  currentCustomers: TopWorkOrderCustomer[],
  pinnedCustomers: TopWorkOrderCustomer[],
) {
  return pinnedCustomers.length > 0 ? pinnedCustomers : currentCustomers;
}

export function buildWorkOrderSummaryCardsFromCounts(
  summary: WorkOrderListSummary,
): WorkOrderSummaryCard[] {
  return [
    {
      id: "completed",
      label: "Selesai",
      value: summary.completed,
      tone: "emerald",
      description: "COMPLETED, VERIFIED, CLOSED",
    },
    {
      id: "unfinished",
      label: "Belum selesai",
      value: summary.unfinished,
      tone: "amber",
      description: "Masih perlu tindak lanjut",
    },
    {
      id: "focut",
      label: "FOCUT",
      value: summary.focut,
      tone: "sky",
      description: "Judul berisi FOCUT, LOS, atau mati",
    },
    {
      id: "dismantle",
      label: "Dismantle",
      value: summary.dismantle,
      tone: "rose",
      description: "DISCONNECTION atau penarikan/cabut",
    },
    {
      id: "averageCompletionTime",
      label: "Rata-rata waktu",
      value: formatCompletionHours(summary.averageCompletionTimeHours),
      tone: "indigo",
      description: "Dihitung dari startedAt sampai completedAt",
    },
  ];
}

function formatCompletionHours(hours: number) {
  if (hours <= 0) return "-";
  if (hours < 1) return `${Math.round(hours * 60)} menit`;

  const roundedHours = Math.round(hours * 10) / 10;
  return `${roundedHours.toLocaleString("id-ID")} jam`;
}
