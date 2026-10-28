"use client";

import type { SamplePackage } from "@/modules/sample-invoice";

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
      <p className="text-xs text-gray-500">
        Setiap pelanggan mendapat satu paket acak, tetap di semua bulan.
      </p>
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-[1fr_8rem_9rem_auto] gap-2">
          <input
            name={`package-${index}-name`}
            className="rounded border px-2 py-1 text-sm dark:bg-gray-900"
            placeholder="Nama paket"
            value={row.name}
            onChange={(e) => update(index, "name", e.target.value)}
          />
          <input
            name={`package-${index}-speed`}
            className="rounded border px-2 py-1 text-sm dark:bg-gray-900"
            placeholder="Kecepatan"
            value={row.speed}
            onChange={(e) => update(index, "speed", e.target.value)}
          />
          <input
            name={`package-${index}-price`}
            className="rounded border px-2 py-1 text-sm dark:bg-gray-900"
            placeholder="Harga (Rp)"
            inputMode="numeric"
            value={row.price}
            onChange={(e) =>
              update(index, "price", e.target.value.replace(/\D/g, ""))
            }
          />
          <button
            type="button"
            className="text-sm text-red-600 disabled:opacity-40"
            disabled={rows.length === 1}
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            Hapus
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-sm text-blue-600"
        onClick={() => onChange([...rows, emptyPackageRow()])}
      >
        + Tambah paket
      </button>
    </div>
  );
}
