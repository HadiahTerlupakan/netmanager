"use client";

import { getRestockStatus } from "./restockStatus";
import type { PurchaseRequest } from "./types";

interface RestockStatusBadgeProps {
  request: PurchaseRequest;
}

interface RestockProgressStatusProps extends RestockStatusBadgeProps {
  /** Versi ringkas untuk sel tabel: kalimat maks. 2 baris. */
  isCompact?: boolean;
}

/** Badge status pengajuan (mis. "Menunggu Persetujuan", "Sudah Dimasukkan"). */
export function RestockStatusBadge({ request }: RestockStatusBadgeProps) {
  const status = getRestockStatus(request);
  return (
    <span
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${status.badgeClassName}`}
    >
      {status.label}
    </span>
  );
}

/** Badge dan kalimat penjelas, untuk sel status di tabel, kartu, dan detail. */
export function RestockProgressStatus({
  request,
  isCompact = false,
}: RestockProgressStatusProps) {
  const { sentence } = getRestockStatus(request);
  return (
    <div
      className={`flex min-w-0 flex-col items-start text-left ${isCompact ? "gap-1.5" : "gap-1"}`}
    >
      <RestockStatusBadge request={request} />
      <p
        className={
          isCompact
            ? "line-clamp-2 text-xs leading-snug text-gray-600 dark:text-gray-300"
            : "text-xs leading-snug text-gray-700 dark:text-gray-300"
        }
        title={isCompact ? sentence : undefined}
      >
        {sentence}
      </p>
    </div>
  );
}
