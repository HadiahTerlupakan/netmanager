import Link from "next/link";

import {
  HiArrowPath,
  HiCog6Tooth,
  HiOutlineChartBar,
  HiPencil,
  HiTrash,
} from "react-icons/hi2";

import ResponsiveTable from "@/components/ui/ResponsiveTable";

import type { MikrotikRouterListItem } from "@/app/admin/network/mikrotik/hooks/useMikrotikRouterList";
import { MIKROTIK_PAGINATION } from "../constants";

type MikrotikRouterTableProps = {
  routers: MikrotikRouterListItem[];
  total: number;
  totalPages: number;
  page: number;
  limit: number;
  loading: boolean;
  search: string;
  pppConnectionMode: "RADIUS" | "MIKROTIK_API";
  onSearchChange: (value: string) => void;
  onLimitChange: (value: number) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onOpenReconfigure: () => void;
  onTestConnection: (id: string) => void;
  onDelete: (id: string, name: string) => void;
};

const formatDateTime = (date: Date | null) => {
  if (!date) {
    return "N/A";
  }

  return new Date(date).toLocaleString("id-ID", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export function MikrotikRouterTable({
  routers,
  total,
  totalPages,
  page,
  limit,
  loading,
  search,
  pppConnectionMode,
  onSearchChange,
  onLimitChange,
  onPrevPage,
  onNextPage,
  onOpenReconfigure,
  onTestConnection,
  onDelete,
}: MikrotikRouterTableProps) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Router {pppConnectionMode === "RADIUS" && "[NAS]"}
        </h1>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={onOpenReconfigure}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 transition-colors shadow-sm"
          >
            <HiCog6Tooth className="w-4 h-4 text-white" />
            <span className="text-white">Reconfigurasi Mikrotik</span>
          </button>
          <Link
            href="/admin/network/mikrotik/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 dark:bg-blue-400 text-white text-sm font-medium rounded-lg hover:bg-blue-700 dark:hover:bg-blue-400 transition-colors shadow-sm"
          >
            <span className="text-white">+</span>
            <span className="text-white">Tambah Router</span>
          </Link>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
          INFO:
        </div>
        <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1 list-disc list-inside">
          <li>
            Sistem akan mengecek status API connection ke router secara otomatis
            (Real-time).
          </li>
        </ul>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Show
            </span>
            <select
              value={limit}
              onChange={(event) => onLimitChange(Number(event.target.value))}
              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            >
              {MIKROTIK_PAGINATION.LIMIT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              entries
            </span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label
              htmlFor="mikrotik-search"
              className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block"
            >
              Search:
            </label>
            <input
              id="mikrotik-search"
              type="text"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search router..."
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
            />
          </div>
        </div>

        <ResponsiveTable
          loading={loading}
          data={routers}
          columns={[
            {
              key: "status",
              header: "Status",
              priority: "primary",
              render: (router: MikrotikRouterListItem) => (
                <div className="text-center">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                      router.pingStatus === "online"
                        ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
                        : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${router.pingStatus === "online" ? "bg-green-500" : "bg-red-500"}`}
                    ></span>
                    {router.pingStatus === "online" ? "Online" : "Offline"}
                  </span>
                </div>
              ),
            },
            {
              key: "name",
              header: "Nama Router",
              priority: "primary",
              render: (router: MikrotikRouterListItem) => (
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {router.name}
                </div>
              ),
            },
            {
              key: "ipAddress",
              header: "IP Address",
              priority: "primary",
              render: (router: MikrotikRouterListItem) => (
                <div className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                  {router.ipAddress}
                </div>
              ),
            },
            {
              key: "timezone",
              header: "Zona Waktu",
              priority: "secondary",
              render: (router: MikrotikRouterListItem) => (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {router.timezone}
                </div>
              ),
            },
            {
              key: "userOnline",
              header: "User Online",
              priority: "secondary",
              render: (router: MikrotikRouterListItem) => (
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                  <HiOutlineChartBar className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-medium">
                    {router.userOnline} Active
                  </span>
                </div>
              ),
            },
            {
              key: "description",
              header: "Deskripsi",
              priority: "tertiary",
              render: (router: MikrotikRouterListItem) => (
                <div className="text-sm text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                  {router.description || "-"}
                </div>
              ),
            },
            {
              key: "lastStatusCheck",
              header: "Last Check",
              priority: "secondary",
              render: (router: MikrotikRouterListItem) => (
                <div className="text-xs text-gray-500 dark:text-gray-500">
                  {formatDateTime(router.lastStatusCheck)}
                </div>
              ),
            },
          ]}
          keyField="id"
          emptyMessage={
            search
              ? "Tidak ada router yang sesuai dengan pencarian."
              : "Belum ada data Router."
          }
          renderActions={(router: MikrotikRouterListItem) => (
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => onTestConnection(router.id)}
                className="p-2 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                title="Test API Connection"
              >
                <HiArrowPath className="w-5 h-5" />
              </button>
              <Link
                href={`/admin/network/mikrotik/${router.id}/edit`}
                className="p-2 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                title="Edit"
              >
                <HiPencil className="w-5 h-5" />
              </Link>
              <button
                type="button"
                onClick={() => onDelete(router.id, router.name)}
                className="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                title="Delete"
              >
                <HiTrash className="w-5 h-5" />
              </button>
            </div>
          )}
        />

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {total === 0 ? 0 : (page - 1) * limit + 1} to{" "}
            {Math.min(page * limit, total)} of {total} entries
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPrevPage}
              disabled={page === 1}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {page} of {Math.max(1, totalPages)}
            </span>
            <button
              type="button"
              onClick={onNextPage}
              disabled={page >= totalPages}
              className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
