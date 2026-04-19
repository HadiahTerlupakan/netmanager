"use client";

import { formatStatusLabel } from "./utils";
import type { PurchaseRequest } from "./types";

interface RestockStatusBadgeProps {
  status: PurchaseRequest["status"];
}

export function RestockStatusBadge({ status }: RestockStatusBadgeProps) {
  const config = formatStatusLabel(status);
  return (
    <span
      className={`inline-flex min-w-[4.75rem] items-center justify-center rounded-full px-2.5 py-1 text-[11px] font-black tracking-[-0.02em] ${config.className}`}
    >
      {config.label}
    </span>
  );
}
