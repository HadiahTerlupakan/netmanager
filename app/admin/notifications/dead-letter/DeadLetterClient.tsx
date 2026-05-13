"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { clientLogger } from "@/lib/client-logger";

type NotifChannel = "inApp" | "push" | "whatsapp" | "email";

interface DeadLetterEntry {
  id: string;
  channel: NotifChannel;
  pelangganId: string;
  templateKey: string;
  params: unknown;
  error: string;
  attemptCount: number;
  lastAttemptAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const CHANNEL_BADGE: Record<NotifChannel, string> = {
  inApp: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  push: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  whatsapp:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  email:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
};

/** Halaman admin untuk melihat dan mengelola Notification Dead Letter Queue. */
export default function DeadLetterClient() {
  const [entries, setEntries] = useState<DeadLetterEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  });
  const [channelFilter, setChannelFilter] = useState<string>("");
  const [showResolved, setShowResolved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEntries = useCallback(
    async (page: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "50",
          resolved: String(showResolved),
        });
        if (channelFilter) params.set("channel", channelFilter);

        const res = await fetch(
          `/api/admin/notifications/dead-letter?${params}`,
        );
        const json = await res.json();
        if (json.success) {
          setEntries(json.data.items);
          setPagination(json.data.pagination);
        }
      } catch (err) {
        clientLogger.error("Error fetching dead letter queue:", err);
      } finally {
        setLoading(false);
      }
    },
    [channelFilter, showResolved],
  );

  useEffect(() => {
    fetchEntries(1);
  }, [fetchEntries]);

  async function handleRetry(id: string) {
    setActionLoading(id + ":retry");
    try {
      const res = await fetch(
        `/api/admin/notifications/dead-letter/${id}/retry`,
        { method: "POST" },
      );
      const json = await res.json();
      if (json.success) {
        // Hapus dari list setelah berhasil retry
        setEntries((prev) => prev.filter((e) => e.id !== id));
      } else {
        alert(json.error ?? "Gagal melakukan retry");
      }
    } catch (err) {
      clientLogger.error("Error retrying entry:", err);
      alert("Terjadi kesalahan saat retry");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResolve(id: string) {
    setActionLoading(id + ":resolve");
    try {
      const res = await fetch(
        `/api/admin/notifications/dead-letter/${id}/resolve`,
        { method: "POST" },
      );
      const json = await res.json();
      if (json.success) {
        setEntries((prev) => prev.filter((e) => e.id !== id));
      } else {
        alert(json.error ?? "Gagal menandai resolved");
      }
    } catch (err) {
      clientLogger.error("Error resolving entry:", err);
      alert("Terjadi kesalahan saat resolve");
    } finally {
      setActionLoading(null);
    }
  }

  function goToPage(page: number) {
    fetchEntries(page);
    setPagination((p) => ({ ...p, page }));
  }

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Notification Dead Letter Queue
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Notifikasi yang gagal terkirim setelah semua retry habis
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
      <div className="flex gap-3 flex-wrap items-center">
        <select
          value={channelFilter}
          onChange={(e) => {
            setChannelFilter(e.target.value);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Semua Channel</option>
          <option value="inApp">In-App</option>
          <option value="push">Push</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
        </select>

        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => {
              setShowResolved(e.target.checked);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          Tampilkan yang sudah resolved
        </label>

        <button
          onClick={() => fetchEntries(pagination.page)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title="Refresh"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Tabel */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Waktu
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Channel
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Pelanggan ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Template
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Error
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Attempt
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-gray-500 dark:text-gray-400"
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
                    Memuat data...
                  </div>
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-gray-500 dark:text-gray-400"
                >
                  {showResolved
                    ? "Tidak ada entry resolved"
                    : "Tidak ada entry yang pending — semua notifikasi berhasil terkirim"}
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <>
                  <tr
                    key={entry.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${CHANNEL_BADGE[entry.channel] ?? "bg-gray-100 text-gray-700"}`}
                      >
                        {entry.channel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-mono text-xs">
                      {entry.pelangganId}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 font-mono text-xs">
                      {entry.templateKey}
                    </td>
                    <td className="px-4 py-3 text-red-600 dark:text-red-400 max-w-[200px] truncate">
                      {entry.error}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-center">
                      {entry.attemptCount}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {!entry.resolvedAt && (
                          <>
                            <button
                              onClick={() => handleRetry(entry.id)}
                              disabled={actionLoading !== null}
                              className="px-2.5 py-1 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {actionLoading === entry.id + ":retry"
                                ? "..."
                                : "Retry"}
                            </button>
                            <button
                              onClick={() => handleResolve(entry.id)}
                              disabled={actionLoading !== null}
                              className="px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {actionLoading === entry.id + ":resolve"
                                ? "..."
                                : "Resolve"}
                            </button>
                          </>
                        )}
                        {entry.resolvedAt && (
                          <span className="text-xs text-green-600 dark:text-green-400">
                            Resolved
                          </span>
                        )}
                        <button
                          onClick={() => toggleExpand(entry.id)}
                          className="px-2 py-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                          title="Lihat params"
                        >
                          {expandedId === entry.id ? "▲" : "▼"}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === entry.id && (
                    <tr key={entry.id + "-expand"}>
                      <td
                        colSpan={7}
                        className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50"
                      >
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          <span className="font-semibold">Params:</span>
                          <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-x-auto">
                            {JSON.stringify(entry.params, null, 2)}
                          </pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>
          Halaman {pagination.page} dari {pagination.totalPages} &middot;{" "}
          {pagination.total} total
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => goToPage(pagination.page - 1)}
            disabled={pagination.page <= 1 || loading}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ‹ Sebelumnya
          </button>
          <button
            onClick={() => goToPage(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages || loading}
            className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Selanjutnya ›
          </button>
        </div>
      </div>
    </div>
  );
}
