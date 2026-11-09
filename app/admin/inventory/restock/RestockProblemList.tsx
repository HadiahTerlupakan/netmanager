"use client";

import { FiAlertTriangle } from "react-icons/fi";

interface RestockProblemListProps {
  problems: string[];
  /** Judul daftar, misalnya "Belum bisa disimpan:". */
  title: string;
  id?: string;
}

/**
 * Alasan tombol utama mati. Tanpa daftar ini petugas hanya melihat tombol
 * pudar tanpa tahu apa yang kurang.
 */
export function RestockProblemList({
  problems,
  title,
  id,
}: RestockProblemListProps) {
  return (
    <div
      id={id}
      role="status"
      className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
    >
      <p className="flex items-center gap-2 font-bold">
        <FiAlertTriangle aria-hidden="true" /> {title}
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-6">
        {problems.map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>
    </div>
  );
}
