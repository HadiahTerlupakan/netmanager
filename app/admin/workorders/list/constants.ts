import type { WorkOrderListSummary, WorkOrderSummaryCard } from "./summary";

export const EMPTY_WORK_ORDER_SUMMARY: WorkOrderListSummary = {
  completed: 0,
  unfinished: 0,
  focut: 0,
  dismantle: 0,
  averageCompletionTimeHours: 0,
  topCustomers: [],
};

export const WORK_ORDER_PAGE_SIZE = 20;
export const WORK_ORDER_SEARCH_DEBOUNCE_MS = 300;

export const summaryToneClasses: Record<WorkOrderSummaryCard["tone"], string> =
  {
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
    amber:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
    sky: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300",
    rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300",
    indigo:
      "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300",
  };
