import type { PlanningStatus, MilestoneStatus } from "@/modules/planning";

/** Konfigurasi warna + label untuk PlanningStatus, dipakai di seluruh UI planning. */
export const PLANNING_STATUS_CONFIG: Record<
  PlanningStatus,
  { label: string; className: string; dot: string }
> = {
  BACKLOG: {
    label: "Backlog",
    className:
      "bg-gray-100 dark:bg-gray-700/40 text-gray-700 dark:text-gray-300",
    dot: "bg-gray-500",
  },
  PENDING_APPROVAL: {
    label: "Menunggu Approval",
    className:
      "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200",
    dot: "bg-amber-500",
  },
  APPROVED_LEVEL1: {
    label: "Approved L1",
    className:
      "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200",
    dot: "bg-blue-500",
  },
  APPROVED: {
    label: "Disetujui",
    className:
      "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
    dot: "bg-green-500",
  },
  IN_PROGRESS: {
    label: "Berjalan",
    className:
      "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200",
    dot: "bg-indigo-500",
  },
  COMPLETED: {
    label: "Selesai",
    className:
      "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200",
    dot: "bg-emerald-500",
  },
  REJECTED: {
    label: "Ditolak",
    className: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
    dot: "bg-red-500",
  },
  CANCELLED: {
    label: "Dibatalkan",
    className:
      "bg-gray-100 dark:bg-gray-700/40 text-gray-500 dark:text-gray-400",
    dot: "bg-gray-400",
  },
};

/** Konfigurasi warna untuk MilestoneStatus. */
export const MILESTONE_STATUS_CONFIG: Record<
  MilestoneStatus,
  { label: string; className: string; dot: string }
> = {
  PENDING: {
    label: "Pending",
    className:
      "bg-gray-100 dark:bg-gray-700/40 text-gray-700 dark:text-gray-300",
    dot: "bg-gray-400",
  },
  IN_PROGRESS: {
    label: "Berjalan",
    className:
      "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200",
    dot: "bg-indigo-500",
  },
  COMPLETED: {
    label: "Selesai",
    className:
      "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200",
    dot: "bg-green-500",
  },
  BLOCKED: {
    label: "Terblokir",
    className: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200",
    dot: "bg-red-500",
  },
};

/** Format rupiah ringkas: 1.5M, 750K, dll. */
export function formatBudget(value: number | null | undefined): string {
  if (value == null) return "-";
  if (value >= 1_000_000_000)
    return `Rp ${(value / 1_000_000_000).toFixed(1)}M`;
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}jt`;
  if (value >= 1_000) return `Rp ${(value / 1_000).toFixed(0)}K`;
  return `Rp ${value.toLocaleString("id-ID")}`;
}

/** Format tanggal Indonesia: "9 Agu 2026". */
export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Kanan kanban column labels (5 kolom utama). */
export const KANBAN_COLUMN_LABELS: Record<PlanningStatus, string> = {
  BACKLOG: "Backlog",
  PENDING_APPROVAL: "Menunggu Approval",
  APPROVED: "Disetujui",
  IN_PROGRESS: "Berjalan",
  COMPLETED: "Selesai",
  APPROVED_LEVEL1: "Approved L1",
  REJECTED: "Ditolak",
  CANCELLED: "Dibatalkan",
};
