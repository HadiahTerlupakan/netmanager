"use client";

import { HiOutlinePlus, HiOutlineTrash } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import type { SamplePackage } from "@/modules/sample-invoice";
import { inputClass } from "./ui";

type Row = { name: string; speed: string; price: string };

export const emptyPackageRow = (): Row => ({ name: "", speed: "", price: "" });

/** Paket yang valid: nama terisi dan harga bilangan bulat lebih dari 0. */
export function toPackages(rows: Row[]): SamplePackage[] {
  return rows
    .map((row) => ({
      name: row.name.trim(),
      speed: row.speed.trim(),
      price: Number(row.price),
    }))
    .filter((pkg) => pkg.name && Number.isInteger(pkg.price) && pkg.price > 0);
}

export function PackagesTable({
  rows,
  onChange,
}: {
  rows: Row[];
  onChange: (rows: Row[]) => void;
}) {
  const update = (index: number, field: keyof Row, value: string) =>
    onChange(
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );

  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[1fr_9rem_11rem_2.5rem] gap-2 px-1 text-xs font-medium uppercase tracking-wide text-gray-500 sm:grid dark:text-gray-400">
        <span>Nama paket</span>
        <span>Kecepatan</span>
        <span>Harga / bulan</span>
        <span />
      </div>
      {rows.map((row, index) => (
        <div
          key={index}
          className="grid grid-cols-[1fr_2.5rem] gap-2 sm:grid-cols-[1fr_9rem_11rem_2.5rem]"
        >
          <input
            name={`package-${index}-name`}
            aria-label="Nama paket"
            className={`${inputClass} col-span-2 sm:col-span-1`}
            placeholder="mis. Home 20"
            value={row.name}
            onChange={(e) => update(index, "name", e.target.value)}
          />
          <input
            name={`package-${index}-speed`}
            aria-label="Kecepatan"
            className={inputClass}
            placeholder="20 Mbps"
            value={row.speed}
            onChange={(e) => update(index, "speed", e.target.value)}
          />
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-gray-400">
              Rp
            </span>
            <input
              name={`package-${index}-price`}
              aria-label="Harga per bulan"
              className={`${inputClass} pl-9 text-right tabular-nums`}
              placeholder="250000"
              inputMode="numeric"
              value={row.price}
              onChange={(e) =>
                update(index, "price", e.target.value.replace(/\D/g, ""))
              }
            />
          </div>
          <button
            type="button"
            aria-label="Hapus paket"
            title="Hapus paket"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-red-500/10"
            disabled={rows.length === 1}
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            <HiOutlineTrash className="h-5 w-5" />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onChange([...rows, emptyPackageRow()])}
        >
          <HiOutlinePlus /> Tambah paket
        </Button>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Setiap pelanggan mendapat satu paket acak, tetap di semua bulan.
        </p>
      </div>
    </div>
  );
}
