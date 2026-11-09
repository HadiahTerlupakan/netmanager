"use client";

import {
  getRestockProgress,
  RESTOCK_STAGE_COUNT,
  RESTOCK_STAGE_TITLES,
} from "./restockProgress";
import type { PurchaseRequest } from "./types";

interface RestockStatusBadgeProps {
  request: PurchaseRequest;
}

interface RestockProgressStatusProps extends RestockStatusBadgeProps {
  /** Versi ringkas untuk sel tabel: tahap satu baris, kalimat maks. 2 baris. */
  isCompact?: boolean;
}

/** Badge status turunan pengajuan (mis. "Belum Dibeli", "Datang Sebagian"). */
export function RestockStatusBadge({ request }: RestockStatusBadgeProps) {
  const progress = getRestockProgress(request);
  return (
    <span
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${progress.badgeClassName}`}
    >
      {progress.label}
    </span>
  );
}

/** Tahap, badge, dan kalimat penjelas, untuk sel status di tabel dan kartu. */
export function RestockProgressStatus({
  request,
  isCompact = false,
}: RestockProgressStatusProps) {
  const progress = getRestockProgress(request);
  if (isCompact) {
    return (
      <div className="flex min-w-0 flex-col items-start gap-1.5 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <RestockStatusBadge request={request} />
          {progress.stage !== null && (
            <span
              className="whitespace-nowrap text-xs font-semibold text-gray-500 dark:text-gray-400"
              title={progress.stageText}
            >
              Tahap {progress.stage}/{RESTOCK_STAGE_COUNT} ·{" "}
              {RESTOCK_STAGE_TITLES[progress.stage]}
            </span>
          )}
        </div>
        <p
          className="line-clamp-2 text-xs leading-snug text-gray-600 dark:text-gray-300"
          title={progress.sentence}
        >
          {progress.sentence}
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start gap-1 text-left">
      {progress.stageText && (
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          {progress.stageText}
        </p>
      )}
      <RestockStatusBadge request={request} />
      <p className="text-xs leading-snug text-gray-700 dark:text-gray-300">
        {progress.sentence}
      </p>
    </div>
  );
}
