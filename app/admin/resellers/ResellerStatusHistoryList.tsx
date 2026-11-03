"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/lib/hooks/useApi";
import { resellerApiUrl } from "./commission-ui";
import { LoadErrorState } from "./LoadErrorState";
import type { ResellerStatus, ResellerStatusHistoryItem } from "./types";
import { RESELLER_STATUS_LABELS } from "./types";

const PAGE_SIZE = 10;
/** Selaras `MAX_STATUS_HISTORY_LIMIT` di validator server. */
const MAX_LIMIT = 100;

const dateTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

function formatTransition(
  fromStatus: ResellerStatus | null,
  toStatus: ResellerStatus,
): string {
  const toLabel = RESELLER_STATUS_LABELS[toStatus];
  return fromStatus
    ? `${RESELLER_STATUS_LABELS[fromStatus]} → ${toLabel}`
    : `Dibuat sebagai ${toLabel}`;
}

/** Bangun URL riwayat status dengan batas jumlah baris. */
export function buildStatusHistoryUrl(resellerId: string, limit: number) {
  return `${resellerApiUrl(resellerId, "status-history")}?limit=${limit}`;
}

/**
 * Riwayat perubahan status kemitraan reseller, terbaru lebih dulu. Dimuat
 * ulang ketika `statusChangedAt` berubah (setelah admin mengubah status).
 */
export function ResellerStatusHistoryList({
  resellerId,
  statusChangedAt,
}: {
  readonly resellerId: string;
  readonly statusChangedAt: string | null;
}) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const historyQuery = useApi<readonly ResellerStatusHistoryItem[]>(
    buildStatusHistoryUrl(resellerId, limit),
  );
  const { refetch } = historyQuery;

  useEffect(() => {
    void refetch();
  }, [statusChangedAt, refetch]);

  const items = historyQuery.data ?? [];
  const canLoadMore = items.length >= limit && limit < MAX_LIMIT;

  return (
    <section className="mt-4">
      <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
        Riwayat status
      </h3>
      {historyQuery.error ? (
        <LoadErrorState
          title="Riwayat status gagal dimuat"
          error={historyQuery.error}
          onRetry={() => void refetch()}
        />
      ) : historyQuery.isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Memuat...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Belum ada perubahan status yang tercatat.
        </p>
      ) : (
        <ol className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-gray-100 p-2.5 text-sm dark:border-gray-700"
            >
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatTransition(item.fromStatus, item.toStatus)}
                </span>
                <time
                  dateTime={item.changedAt}
                  className="text-gray-500 dark:text-gray-400"
                >
                  {dateTimeFormatter.format(new Date(item.changedAt))}
                </time>
              </div>
              {item.reason && (
                <p className="mt-1 text-gray-600 dark:text-gray-300">
                  {item.reason}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
      {canLoadMore && (
        <button
          type="button"
          className="mt-2 text-sm text-blue-600 underline dark:text-blue-400"
          onClick={() =>
            setLimit((current) => Math.min(current + PAGE_SIZE, MAX_LIMIT))
          }
        >
          Tampilkan lebih banyak
        </button>
      )}
    </section>
  );
}
