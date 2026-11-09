"use client";

import { useEffect, useId, useRef } from "react";
import { FiCheckCircle } from "react-icons/fi";

import { RestockNotComingReasonSelect } from "./RestockNotComingReasonSelect";
import {
  getRestockShortfallConfirmMessage,
  type RestockReceiveLine,
  type RestockReceiveSummary,
} from "./restockReceiveForm";

interface RestockFollowUpSectionProps {
  summary: RestockReceiveSummary;
  /** Nomor bagian; 2 bila bagian foto tidak tampil. */
  stepNumber: number;
  /** Menyelesaikan sekarang membatalkan pesanan (belum ada barang datang). */
  isCancellingOrder: boolean;
  isFinishingOrder: boolean;
  onIsFinishingOrderChange: (value: boolean) => void;
  closeReason: string;
  onCloseReasonChange: (reason: string) => void;
}

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

interface FollowUpOptionProps {
  name: string;
  isChecked: boolean;
  title: string;
  description: string;
  onSelect: () => void;
}

function FollowUpOption({
  name,
  isChecked,
  title,
  description,
  onSelect,
}: FollowUpOptionProps) {
  return (
    <label
      className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 ${isChecked ? "border-indigo-600 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/30" : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"}`}
    >
      <input
        type="radio"
        name={name}
        checked={isChecked}
        onChange={onSelect}
        className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 focus:ring-indigo-500"
      />
      <span>
        <span className="block text-sm font-bold text-gray-900 dark:text-white">
          {title}
        </span>
        <span className="mt-0.5 block text-sm text-gray-700 dark:text-gray-300">
          {description}
        </span>
      </span>
    </label>
  );
}

/**
 * Bagian 3 modal penerimaan: kotak hijau bila semua sisa datang hari ini,
 * atau pertanyaan "Apakah masih ada barang yang akan menyusul?".
 */
export function RestockFollowUpSection({
  summary,
  stepNumber,
  isCancellingOrder,
  isFinishingOrder,
  onIsFinishingOrderChange,
  closeReason,
  onCloseReasonChange,
}: RestockFollowUpSectionProps) {
  const radioName = useId();
  if (!summary.hasRemainderAfterToday) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-900 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-200">
        <FiCheckCircle aria-hidden="true" className="mt-0.5 shrink-0" />
        Semua barang sudah lengkap. Setelah disimpan, pesanan ini selesai.
      </div>
    );
  }

  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-base font-bold text-gray-900 dark:text-white">
        {stepNumber}. Apakah masih ada barang yang akan menyusul?
      </legend>
      <FollowUpOption
        name={radioName}
        isChecked={!isFinishingOrder}
        title="Ya, sisanya masih ditunggu"
        description='Saat sisanya datang, buka pengajuan ini lagi dan tekan "Catat Kiriman Berikutnya".'
        onSelect={() => onIsFinishingOrderChange(false)}
      />
      <FollowUpOption
        name={radioName}
        isChecked={isFinishingOrder}
        title="Tidak, sisanya tidak akan datang"
        description={
          isCancellingOrder
            ? "Belum ada barang yang datang. Pesanan ini dibatalkan dan tidak ada barang yang masuk gudang."
            : "Pesanan selesai dengan barang kurang. Sisanya tidak bisa dicatat datang lagi."
        }
        onSelect={() => onIsFinishingOrderChange(true)}
      />
      {isFinishingOrder && (
        <div className="space-y-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-orange-950 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-100">
          <RestockNotComingReasonSelect
            reason={closeReason}
            onReasonChange={onCloseReasonChange}
          />
          <div>
            <p className="text-sm font-bold">Barang yang tidak jadi datang:</p>
            <RestockReceiveLineList lines={summary.notComing} />
            <p className="mt-2 text-sm">
              Barang ini tidak masuk gudang. Kalau sudah terlanjur dibayar, beri
              tahu admin.
            </p>
          </div>
        </div>
      )}
    </fieldset>
  );
}

interface SummaryBlockProps {
  title: string;
  lines: RestockReceiveLine[];
  emptyText?: string;
  className: string;
}

function SummaryBlock({
  title,
  lines,
  emptyText,
  className,
}: SummaryBlockProps) {
  if (lines.length === 0 && !emptyText) return null;
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

/** Ringkasan langsung di atas tombol simpan; berubah mengikuti isian. */
export function RestockReceiveSummaryPanel({
  summary,
}: {
  summary: RestockReceiveSummary;
}) {
  return (
    <section
      aria-live="polite"
      aria-label="Ringkasan sebelum disimpan"
      className="grid gap-2 sm:grid-cols-3"
    >
      <SummaryBlock
        title="Masuk gudang hari ini"
        lines={summary.arrivingToday}
        emptyText="Belum ada."
        className="border-green-200 bg-green-50 text-green-950 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-100"
      />
      <SummaryBlock
        title="Masih ditunggu"
        lines={summary.stillAwaited}
        className="border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100"
      />
      <SummaryBlock
        title="Tidak jadi datang"
        lines={summary.notComing}
        className="border-orange-200 bg-orange-50 text-orange-950 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-100"
      />
    </section>
  );
}

interface RestockShortfallConfirmProps {
  summary: RestockReceiveSummary;
  isCancellingOrder: boolean;
  onConfirm: () => void;
  onBack: () => void;
}

/** Konfirmasi di dalam modal sebelum pesanan diselesaikan dengan barang kurang. */
export function RestockShortfallConfirm({
  summary,
  isCancellingOrder,
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
        {getRestockShortfallConfirmMessage(summary, isCancellingOrder)}
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
          {isCancellingOrder ? "Ya, batalkan pesanan" : "Ya, selesaikan"}
        </button>
      </div>
    </div>
  );
}
