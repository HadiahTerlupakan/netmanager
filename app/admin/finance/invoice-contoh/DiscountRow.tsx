"use client";

import { HiOutlineTrash } from "react-icons/hi2";
import type { SampleDiscount } from "@/modules/sample-invoice";
import { inputClass } from "./ui";

export type DiscountDraft = {
  name: string;
  kind: SampleDiscount["kind"];
  value: string;
};

export const emptyDiscount = (): DiscountDraft => ({
  name: "",
  kind: "amount",
  value: "",
});

/** Diskon yang terisi lengkap, atau undefined bila belum. */
export function toDiscount(draft: DiscountDraft | null) {
  if (!draft) return undefined;
  const value = Number(draft.value);
  const name = draft.name.trim();
  if (!name || !Number.isInteger(value) || value <= 0) return undefined;
  return { name, kind: draft.kind, value } satisfies SampleDiscount;
}

/** Sama dengan aturan server: tidak boleh menghabiskan seluruh tagihan. */
function tooLarge(draft: DiscountDraft, gross: number) {
  const value = Number(draft.value);
  if (!value) return false;
  return draft.kind === "percent" ? value >= 100 : value >= gross;
}

export function DiscountRow(props: {
  packageIndex: number;
  draft: DiscountDraft;
  /** Harga paket + add-on */
  gross: number;
  deleteButtonClass: string;
  onChange: (draft: DiscountDraft) => void;
  onRemove: () => void;
}) {
  const { draft, packageIndex } = props;
  const prefix = `package-${packageIndex}-discount`;
  return (
    <div className="space-y-1 border-l-2 border-green-300 pl-3 sm:ml-4 dark:border-green-500/40">
      <div className="grid grid-cols-[1fr_5.5rem_2.5rem] gap-2 sm:grid-cols-[1fr_6rem_11rem_2.5rem]">
        <input
          name={`${prefix}-name`}
          aria-label="Nama diskon"
          className={`${inputClass} col-span-3 sm:col-span-1`}
          placeholder="Diskon, mis. Promo loyal"
          value={draft.name}
          onChange={(e) => props.onChange({ ...draft, name: e.target.value })}
        />
        <select
          name={`${prefix}-kind`}
          aria-label="Jenis diskon"
          className={inputClass}
          value={draft.kind}
          onChange={(e) =>
            props.onChange({
              ...draft,
              kind: e.target.value as DiscountDraft["kind"],
            })
          }
        >
          <option value="amount">Rp</option>
          <option value="percent">%</option>
        </select>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400">
            {draft.kind === "amount" ? "- Rp" : "-"}
          </span>
          <input
            name={`${prefix}-value`}
            aria-label="Nilai diskon"
            className={`${inputClass} pl-12 text-right tabular-nums ${
              draft.kind === "percent" ? "pr-8" : ""
            }`}
            placeholder="0"
            inputMode="numeric"
            value={draft.value}
            onChange={(e) =>
              props.onChange({
                ...draft,
                value: e.target.value.replace(/\D/g, ""),
              })
            }
          />
          {draft.kind === "percent" && (
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-400">
              %
            </span>
          )}
        </div>
        <button
          type="button"
          aria-label="Hapus diskon"
          title="Hapus diskon"
          className={props.deleteButtonClass}
          onClick={props.onRemove}
        >
          <HiOutlineTrash className="h-5 w-5" />
        </button>
      </div>
      {tooLarge(draft, props.gross) && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          Diskon harus lebih kecil dari harga paket + add-on.
        </p>
      )}
    </div>
  );
}
