"use client";

import { useEffect, useId, useRef } from "react";
import { FiInfo } from "react-icons/fi";

import {
  getRestockShortfallConfirmMessage,
  type RestockReceiveLine,
  type RestockReceiveSummary,
} from "./restockReceiveForm";

function RestockReceiveLineList({ lines }: { lines: RestockReceiveLine[] }) {
  return (
    <ul className="mt-1 space-y-0.5 text-sm">
      {lines.map((line) => (
        <li key={line.barangId}>
          • {line.nama} — {line.quantity} {line.satuan}
        </li>
      ))}
    </ul>
  );
}

interface SummaryBlockProps {
  title: string;
  lines: RestockReceiveLine[];
  emptyText: string;
  className: string;
}

function SummaryBlock({
  title,
  lines,
  emptyText,
  className,
}: SummaryBlockProps) {
  return (
    <div className={`rounded-xl border p-3 ${className}`}>
      <p className="text-sm font-bold">{title}</p>
      {lines.length > 0 ? (
        <RestockReceiveLineList lines={lines} />
      ) : (
        <p className="mt-1 text-sm">{emptyText}</p>
      )}
    </div>
  );
}

interface RestockReceiveSummaryPanelProps {
  summary: RestockReceiveSummary;
  /** Masih ada jasa yang belum ditandai selesai di pengajuan ini. */
  hasPendingJasa: boolean;
  /** Pesanannya juga dipakai pengajuan lain: angka ringkasan hanya bagian pengajuan ini. */
  isMergedOrder: boolean;
}

const MERGED_ORDER_NOTE =
  " Pesanan ini dipakai bersama pengajuan lain; sisa milik pengajuan lain yang belum selesai tidak ikut ditutup.";

/**
 * Ringkasan langsung di atas tombol simpan; berubah mengikuti isian. Selalu
 * mengingatkan bahwa pengajuan selesai setelah disimpan.
 */
export function RestockReceiveSummaryPanel({
  summary,
  hasPendingJasa,
  isMergedOrder,
}: RestockReceiveSummaryPanelProps) {
  return (
    <section
      aria-live="polite"
      aria-label="Ringkasan sebelum disimpan"
      className="space-y-2"
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <SummaryBlock
          title="Sampai"
          lines={summary.entering}
          emptyText="Belum ada."
          className="border-green-200 bg-green-50 text-green-950 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-100"
        />
        <SummaryBlock
          title="Tidak sampai"
          lines={summary.notEntered}
          emptyText="Tidak ada."
          className="border-orange-200 bg-orange-50 text-orange-950 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-100"
        />
      </div>
      <p className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-100">
        <FiInfo aria-hidden="true" className="mt-0.5 shrink-0" />
        <span>
          Pengajuan akan selesai setelah disimpan.
          {isMergedOrder && MERGED_ORDER_NOTE}
          {hasPendingJasa && " Jasa tetap ditandai lewat Konfirmasi Jasa."}
        </span>
      </p>
    </section>
  );
}

interface RestockShortfallConfirmProps {
  summary: RestockReceiveSummary;
  onConfirm: () => void;
  onBack: () => void;
}

/**
 * Konfirmasi di dalam modal sebelum pengajuan diselesaikan dengan barang
 * yang masuk kurang dari sisanya.
 */
export function RestockShortfallConfirm({
  summary,
  onConfirm,
  onBack,
}: RestockShortfallConfirmProps) {
  const messageId = useId();
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  return (
    <div
      role="alertdialog"
      aria-modal="false"
      aria-labelledby={messageId}
      className="space-y-3 rounded-2xl border-2 border-orange-300 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950/30"
    >
      <p
        id={messageId}
        className="text-sm font-bold text-orange-950 dark:text-orange-100"
      >
        {getRestockShortfallConfirmMessage(summary)}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] flex-1 rounded-2xl bg-gray-100 px-4 py-3 font-bold text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-100"
        >
          Kembali
        </button>
        <button
          ref={confirmRef}
          type="button"
          onClick={onConfirm}
          className="min-h-[44px] flex-[2] rounded-2xl bg-orange-700 px-4 py-3 font-bold text-white hover:bg-orange-800"
        >
          Ya, selesaikan
        </button>
      </div>
    </div>
  );
}
