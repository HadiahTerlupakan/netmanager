import type { ReactNode } from "react";

/** Kartu berjudul untuk mengelompokkan isian di halaman editor & buat dokumen. */
export default function EditorCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <h2 className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
        {title}
      </h2>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  );
}

/** Kisi dua kolom: isian di kiri, pratinjau di kanan; satu kolom di layar sempit. */
export const WORKSPACE_GRID_CLASS = "grid items-start gap-6 lg:grid-cols-2";
