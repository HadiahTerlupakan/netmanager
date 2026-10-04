import type { ReactNode } from "react";

/** Kartu seksi dan baris label–nilai untuk halaman detail dokumen legal. */

/** Kartu berjudul untuk satu seksi detail. */
export function DetailCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">
        {title}
      </h2>
      {children}
    </section>
  );
}

export interface DetailRow {
  label: string;
  value: ReactNode;
}

/** Daftar label–nilai; baris bernilai kosong disembunyikan. */
export function DetailRows({
  rows,
  emptyText,
}: {
  rows: DetailRow[];
  emptyText: string;
}) {
  const filledRows = rows.filter(
    (row) => row.value !== null && row.value !== undefined && row.value !== "",
  );

  if (filledRows.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">{emptyText}</p>;
  }

  return (
    <dl className="space-y-2 text-sm">
      {filledRows.map((row) => (
        <div key={row.label} className="grid grid-cols-3 gap-2">
          <dt className="text-gray-500 dark:text-gray-400">{row.label}</dt>
          <dd className="col-span-2 whitespace-pre-line text-gray-900 dark:text-white">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
