"use client";

import { getRestockProgress } from "./restockProgress";
import type { PurchaseRequest } from "./types";

interface RestockStatusBadgeProps {
  request: PurchaseRequest;
}

/** Badge status turunan pengajuan (mis. "Belum Dibeli", "Datang Sebagian"). */
export function RestockStatusBadge({ request }: RestockStatusBadgeProps) {
  const progress = getRestockProgress(request);
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-bold ${progress.badgeClassName}`}
    >
      {progress.label}
    </span>
  );
}

/** Tahap, badge, dan kalimat penjelas, untuk sel status di tabel dan kartu. */
export function RestockProgressStatus({ request }: RestockStatusBadgeProps) {
  const progress = getRestockProgress(request);
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
