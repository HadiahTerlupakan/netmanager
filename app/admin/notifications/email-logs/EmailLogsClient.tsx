"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { clientLogger } from "@/lib/client-logger";
import {
  TablePaginationFooter,
  type PaginationState,
} from "../_components/TablePaginationFooter";
import { TableEmptyRow, TableLoadingRow } from "../_components/TableStateRows";

type EmailStatus = "PENDING" | "SENT" | "FAILED" | "BOUNCED";

interface EmailLog {
  id: string;
  to: string;
  subject: string;
  status: EmailStatus;
  provider: string;
  messageId: string | null;
  error: string | null;
  sentAt: string | null;
  bouncedAt: string | null;
  createdAt: string;
}

type Pagination = PaginationState;

const STATUS_BADGE: Record<EmailStatus, string> = {
  PENDING:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  SENT: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  BOUNCED:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
};

/** Halaman admin untuk melihat log pengiriman email (EmailDeliveryLog). */
export default function EmailLogsClient() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  });
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(
    async (page: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "50",
        });
        if (statusFilter) params.set("status", statusFilter);
        if (search) params.set("search", search);

        const res = await fetch(
          `/api/admin/notifications/email-logs?${params}`,
        );
        const json = await res.json();
        if (json.success) {
          setLogs(json.data.items);
          setPagination(json.data.pagination);
        }
      } catch (err) {
        const msg = "Gagal memuat log email";
        setError(msg);
        clientLogger.error(msg, err);
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, search],
  );

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs]);

  function handleSearch() {
    setSearch(searchInput);
    setPagination((p) => ({ ...p, page: 1 }));
  }

  function handleStatusChange(value: string) {
    setStatusFilter(value);
    setPagination((p) => ({ ...p, page: 1 }));
  }

  function goToPage(page: number) {
    fetchLogs(page);
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Email Delivery Log
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Riwayat pengiriman email dari sistem notifikasi
          </p>
        </div>
        <Link
          href="/admin/notifications"
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          ← Kembali ke Notifikasi
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Semua Status</option>
          <option value="PENDING">Pending</option>
          <option value="SENT">Sent</option>
          <option value="FAILED">Failed</option>
          <option value="BOUNCED">Bounced</option>
        </select>

        <div className="flex gap-2 flex-1 min-w-[220px]">
          <input
            type="text"
            placeholder="Cari email tujuan..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Cari
          </button>
          <button
            onClick={() => fetchLogs(pagination.page)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabel */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Waktu
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Tujuan
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Subjek
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Provider
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Error
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <TableLoadingRow colSpan={6} />
            ) : logs.length === 0 ? (
              <TableEmptyRow colSpan={6} message="Tidak ada log ditemukan" />
            ) : (
              logs.map((log) => (
                <tr
                  key={log.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100 max-w-[200px] truncate">
                    {log.to}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-[240px] truncate">
                    {log.subject}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_BADGE[log.status]}`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {log.provider}
                  </td>
                  <td className="px-4 py-3 text-red-600 dark:text-red-400 max-w-[240px] truncate">
                    {log.error ?? "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <TablePaginationFooter
        pagination={pagination}
        loading={loading}
        onPageChange={goToPage}
      />
    </div>
  );
}
