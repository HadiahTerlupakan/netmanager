import { formatCurrency } from "@/lib/utils";
import { formatRabProfitShareDescription } from "./rab-formatters";
import type { RABProject } from "./rabTypes";

export const getProfitShareDescription = formatRabProfitShareDescription;

/** Menghasilkan kelas badge sesuai status RAB. */
export function getStatusBadge(status: string) {
  switch (status) {
    case "DRAFT":
      return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
    case "PENDING_APPROVAL":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "APPROVED":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
    case "REJECTED":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
    case "PENGADAAN":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
    case "PENGGELARAN_JARINGAN":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
    case "PENJUALAN":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400";
    case "TARGET_TERCAPAI":
      return "bg-emerald-500 text-white font-bold";
    case "SELESAI":
      return "bg-gray-800 text-white dark:bg-white dark:text-gray-900 font-bold";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

/** Menghasilkan label kategori item RAB yang aman untuk tampilan. */
export function getRabItemCategoryLabel(
  item: RABProject["items"][number] & {
    expenseCategory?: { name: string; parent?: { name: string } };
  },
) {
  const category = item.expenseCategory;
  if (!category) return item.category || "-";
  if (!category.parent) return category.name;
  return `${category.parent.name} - ${category.name}`;
}

/** Menghasilkan label nominal mata uang untuk sel tabel. */
export function getCurrencyLabel(amount: number) {
  return formatCurrency(Number(amount));
}
