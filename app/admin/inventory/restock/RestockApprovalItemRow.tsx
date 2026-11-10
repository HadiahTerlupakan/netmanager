"use client";

import { type ReactNode, useState } from "react";
import { FiRefreshCw, FiRotateCcw } from "react-icons/fi";

import { SearchableSelect } from "@/components/ui/SearchableSelect";

import {
  APPROVAL_LINE_NOTE_MAX_LENGTH,
  describeQuantityChange,
  type RestockSubstituteOption,
} from "./approvalUtils";
import type {
  RestockApprovalKeputusan,
  RestockApprovalLineDecision,
} from "./types";

interface RestockApprovalSubstitution {
  options: RestockSubstituteOption[];
  /** Nama barang pengganti yang sedang dipilih, untuk ditampilkan di baris. */
  selectedName: string | null;
}

interface RestockApprovalItemRowProps {
  /** Id unik baris, dipakai untuk id elemen form. */
  lineId: string;
  name: string;
  kode: string;
  satuan: string;
  /** Jumlah yang diajukan pemohon. */
  requestedQuantity: number;
  decision: RestockApprovalLineDecision;
  isNoteRequired: boolean;
  onChange: (patch: Partial<RestockApprovalLineDecision>) => void;
  /** Tidak diisi untuk baris jasa: jasa tidak bisa diganti. */
  substitution?: RestockApprovalSubstitution;
  /** Stok barang ini di gudang tujuan; tidak diisi untuk baris jasa. */
  stockInfo?: ReactNode;
  disabled: boolean;
}

const DECISION_OPTIONS: Array<{
  value: RestockApprovalKeputusan;
  label: string;
  activeClassName: string;
}> = [
  {
    value: "APPROVED",
    label: "Setujui",
    activeClassName: "bg-emerald-600 text-white",
  },
  {
    value: "REJECTED",
    label: "Tolak",
    activeClassName: "bg-rose-600 text-white",
  },
];

/**
 * Satu baris keputusan approver: setujui/tolak, atur jumlah yang disetujui,
 * ganti barang (khusus barang), dan catatan yang wajib bila permintaan tidak
 * dipenuhi apa adanya.
 */
export function RestockApprovalItemRow({
  lineId,
  name,
  kode,
  satuan,
  requestedQuantity,
  decision,
  isNoteRequired,
  onChange,
  substitution,
  stockInfo,
  disabled,
}: RestockApprovalItemRowProps) {
  const isRejected = decision.keputusan === "REJECTED";
  const quantityHint = isRejected
    ? null
    : describeQuantityChange(requestedQuantity, decision.jumlah, satuan);
  const quantityId = `approval-qty-${lineId}`;

  return (
    <div
      className={`rounded-2xl border p-4 transition-colors ${isRejected ? "border-rose-200 bg-rose-50/40 dark:border-rose-900/40 dark:bg-rose-950/10" : "border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className={`text-sm font-bold ${isRejected ? "text-gray-400 line-through" : "text-gray-900 dark:text-white"}`}
          >
            {substitution?.selectedName ?? name}
          </div>
          <div className="text-xs text-gray-500">
            {substitution?.selectedName ? `Diganti dari ${name} • ` : ""}
            {kode}
          </div>
        </div>
        <div
          role="group"
          aria-label={`Keputusan untuk ${name}`}
          className="inline-flex rounded-xl bg-gray-100 p-1 dark:bg-gray-900"
        >
          {DECISION_OPTIONS.map((option) => {
            const isActive = decision.keputusan === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={disabled}
                aria-pressed={isActive}
                aria-label={`${option.label} ${name}`}
                onClick={() => onChange({ keputusan: option.value })}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${isActive ? option.activeClassName : "text-gray-600 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-800"}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {stockInfo}

      {!isRejected && (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor={quantityId}
              className="text-[10px] font-bold uppercase text-gray-400"
            >
              Jumlah disetujui
            </label>
            <div className="flex items-center gap-2">
              <input
                id={quantityId}
                type="number"
                min={1}
                step={1}
                disabled={disabled}
                aria-label={`Jumlah ${name} disetujui`}
                aria-invalid={!(decision.jumlah >= 1)}
                value={decision.jumlah > 0 ? decision.jumlah : ""}
                onChange={(event) =>
                  onChange({ jumlah: Number.parseInt(event.target.value) || 0 })
                }
                className="w-24 rounded-xl border-none bg-gray-50 text-right font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900"
              />
              <span className="text-[10px] font-bold uppercase text-gray-400">
                {satuan}
              </span>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            <div>
              Diajukan: {requestedQuantity} {satuan}
            </div>
            {quantityHint && (
              <div className="font-bold text-amber-700 dark:text-amber-300">
                {quantityHint}
              </div>
            )}
          </div>
        </div>
      )}

      {!isRejected && substitution && (
        <RestockApprovalSubstitutePicker
          name={name}
          substitution={substitution}
          substituteBarangId={decision.barangIdPengganti}
          onSubstituteChange={(barangIdPengganti) =>
            onChange({ barangIdPengganti })
          }
          disabled={disabled}
        />
      )}

      <RestockApprovalNoteField
        lineId={lineId}
        name={name}
        note={decision.catatan}
        isRequired={isNoteRequired}
        onNoteChange={(catatan) => onChange({ catatan })}
        disabled={disabled}
      />
    </div>
  );
}

interface RestockApprovalSubstitutePickerProps {
  name: string;
  substitution: RestockApprovalSubstitution;
  substituteBarangId: string | null;
  onSubstituteChange: (barangId: string | null) => void;
  disabled: boolean;
}

function RestockApprovalSubstitutePicker({
  name,
  substitution,
  substituteBarangId,
  onSubstituteChange,
  disabled,
}: RestockApprovalSubstitutePickerProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const isPickerVisible = isPickerOpen || !!substituteBarangId;

  const handleToggle = () => {
    if (substituteBarangId) {
      onSubstituteChange(null);
      setIsPickerOpen(false);
      return;
    }
    setIsPickerOpen((previous) => !previous);
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        aria-expanded={isPickerVisible}
        className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 disabled:opacity-50 dark:text-indigo-400"
      >
        {substituteBarangId ? <FiRotateCcw /> : <FiRefreshCw />}
        {substituteBarangId
          ? `Batalkan penggantian ${name}`
          : `Ganti barang ${name}`}
      </button>
      {isPickerVisible && (
        <div className="mt-2">
          <SearchableSelect
            options={substitution.options}
            value={substituteBarangId ?? ""}
            onChange={(value) => onSubstituteChange(value || null)}
            placeholder="Cari barang pengganti..."
            ariaLabel={`Barang pengganti untuk ${name}`}
            disabled={disabled}
          />
        </div>
      )}
    </div>
  );
}

interface RestockApprovalNoteFieldProps {
  lineId: string;
  name: string;
  note: string;
  isRequired: boolean;
  onNoteChange: (note: string) => void;
  disabled: boolean;
}

function RestockApprovalNoteField({
  lineId,
  name,
  note,
  isRequired,
  onNoteChange,
  disabled,
}: RestockApprovalNoteFieldProps) {
  const isMissing = isRequired && note.trim().length === 0;
  const hintId = `approval-note-hint-${lineId}`;

  return (
    <div className="mt-3">
      <input
        type="text"
        maxLength={APPROVAL_LINE_NOTE_MAX_LENGTH}
        disabled={disabled}
        aria-label={`Catatan keputusan ${name}`}
        aria-required={isRequired}
        aria-invalid={isMissing}
        aria-describedby={isMissing ? hintId : undefined}
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        placeholder={
          isRequired ? "Alasan keputusan (wajib)" : "Catatan (tidak wajib)"
        }
        className={`w-full rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500 dark:bg-gray-900 dark:text-gray-200 ${isMissing ? "border-rose-300 dark:border-rose-800" : "border-gray-200 dark:border-gray-700"}`}
      />
      {isMissing && (
        <div
          id={hintId}
          className="mt-1 text-[11px] font-bold text-rose-600 dark:text-rose-400"
        >
          Tulis alasannya supaya pemohon tahu kenapa permintaannya ditolak atau
          diubah.
        </div>
      )}
    </div>
  );
}
