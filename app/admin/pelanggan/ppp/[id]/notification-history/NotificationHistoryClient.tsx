"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/hooks/useApi";

type NotificationChannel = "inApp" | "push" | "whatsapp" | "email";

type NotificationEntry = {
  id: string;
  channel: NotificationChannel | string;
  status: string;
  title: string | null;
  message: string | null;
  error: string | null;
  createdAt: string;
};

interface NotificationHistoryResponse {
  entries: NotificationEntry[];
  pelanggan: { nama: string };
}

const CHANNEL_LABELS: Record<string, string> = {
  inApp: "In-App",
  push: "Push",
  whatsapp: "WhatsApp",
  email: "Email",
};

const CHANNEL_ICONS: Record<string, string> = {
  inApp: "🔔",
  push: "📱",
  whatsapp: "💬",
  email: "✉️",
};

const STATUS_CLASSES: Record<string, string> = {
  SENT: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  READ: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  UNREAD:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  FAILED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  BOUNCED:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  RESOLVED: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  PENDING:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
};

const DEFAULT_STATUS_CLASS =
  "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";

/** Client component untuk menampilkan riwayat notifikasi pelanggan */
export default function NotificationHistoryClient({
  pelangganId,
}: {
  pelangganId: string;
}) {
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);

  const {
    data,
    isLoading,
    error: fetchError,
    mutate,
  } = useApi<NotificationHistoryResponse>(
    `/api/admin/pelanggan/${pelangganId}/notification-history`,
  );

  const entries = data?.entries ?? [];
  const pelangganNama = data?.pelanggan?.nama ?? "";
  const error = fetchError
    ? fetchError.message || "Terjadi kesalahan jaringan"
    : null;

  useEffect(() => {
    if (data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastFetchedAt(new Date());
    }
  }, [data]);

  const loadHistory = () => mutate();

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-950 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              Riwayat Notifikasi
            </h1>
            {pelangganNama && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {pelangganNama}
              </p>
            )}
            {lastFetchedAt && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Terakhir dimuat:{" "}
                {lastFetchedAt.toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => loadHistory()}
              disabled={isLoading}
              className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 border border-gray-200 dark:border-gray-700 rounded-md transition-colors"
              title="Refresh"
            >
              ↻ Refresh
            </button>
            <Link
              href={`/admin/pelanggan/ppp/${pelangganId}`}
              className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              ← Kembali ke Detail
            </Link>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg text-sm">
            {error}
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
            <p className="text-gray-400 dark:text-gray-500 text-sm">
              Belum ada riwayat notifikasi untuk pelanggan ini.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm"
              >
                {/* Channel icon */}
                <div className="text-xl shrink-0 mt-0.5">
                  {CHANNEL_ICONS[entry.channel] ?? "•"}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                      {CHANNEL_LABELS[entry.channel] ?? entry.channel}
                    </span>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_CLASSES[entry.status] ?? DEFAULT_STATUS_CLASS}`}
                    >
                      {entry.status}
                    </span>
                  </div>

                  {entry.title && (
                    <p className="text-sm font-medium text-gray-900 dark:text-white break-words">
                      {entry.title}
                    </p>
                  )}

                  {entry.message && (
                    <p className="text-sm text-gray-600 dark:text-gray-300 break-words mt-0.5">
                      {entry.message}
                    </p>
                  )}

                  {entry.error && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 break-words">
                      Error: {entry.error}
                    </p>
                  )}

                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
                    {new Date(entry.createdAt).toLocaleString("id-ID", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
