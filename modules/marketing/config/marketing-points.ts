/**
 * Konstanta poin & cashout marketing.
 * Why: aturan ini sebelumnya tersebar di repository (poin per status WO)
 * dan service helpers (cashout target). Pemusatan memudahkan tuning &
 * mempersiapkan migrasi ke konfigurasi per-tenant.
 */

export const WO_IN_PROGRESS_POINT = 5;
export const WO_COMPLETED_POINT = 3;
export const APPROVED_CLAIM_POINT = 2;
export const DEFAULT_POINT_VALUE = 2;

export const CASHOUT_DEFAULT_TARGET = 30;
export const ACCUMULATED_TARGET_SCHEMA = "ACCUMULATED" as const;

export const COMPLETED_WORK_ORDER_STATUSES: string[] = [
  "COMPLETED",
  "VERIFIED",
  "CLOSED",
];

export const IN_PROGRESS_WORK_ORDER_STATUSES: string[] = [
  "IN_PROGRESS",
  ...COMPLETED_WORK_ORDER_STATUSES,
];
