import type { ReactNode } from "react";
import { HiOutlineLockClosed } from "react-icons/hi2";
import {
  DEADLINE_KIND_LABEL,
  describeTiming,
  isUrgent,
  labelOf,
  STATUS_LABEL,
} from "./legal-format";

/** Lencana status, label rahasia, dan teks waktu tenggat halaman legal. */

const STATUS_TONE: Record<string, string> = {
  AKTIF: "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  SEGERA_BERAKHIR:
    "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  KEDALUWARSA: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  DIPERPANJANG:
    "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
};

const NEUTRAL_TONE =
  "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300";

const BADGE_CLASS =
  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium";

/** Lencana status dokumen legal. */
export function LegalStatusBadge({ status }: { status: string }) {
  return (
    <span className={`${BADGE_CLASS} ${STATUS_TONE[status] ?? NEUTRAL_TONE}`}>
      {labelOf(STATUS_LABEL, status)}
    </span>
  );
}

/** Lencana untuk dokumen berkategori rahasia. */
export function ConfidentialBadge() {
  return (
    <span
      className={`${BADGE_CLASS} bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300`}
    >
      <HiOutlineLockClosed className="h-3 w-3" />
      Rahasia
    </span>
  );
}

/** Lencana netral serbaguna (mis. jenis tenggat, kategori bawaan). */
export function NeutralBadge({ children }: { children: ReactNode }) {
  return <span className={`${BADGE_CLASS} ${NEUTRAL_TONE}`}>{children}</span>;
}

/** Teks waktu relatif tenggat; merah bila lewat atau tinggal ≤ seminggu. */
export function DeadlineTiming({ daysLeft }: { daysLeft: number }) {
  const tone = isUrgent(daysLeft)
    ? "font-medium text-red-600 dark:text-red-400"
    : "text-gray-600 dark:text-gray-300";

  return <span className={tone}>{describeTiming(daysLeft)}</span>;
}

/** Lencana jenis tenggat (Berakhir, Pemberitahuan, Jaminan, Kewajiban). */
export function DeadlineKindBadge({ kind }: { kind: string }) {
  return <NeutralBadge>{labelOf(DEADLINE_KIND_LABEL, kind)}</NeutralBadge>;
}
