import type { ReactNode } from "react";

export const inputClass =
  "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100";

export const cardClass =
  "rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800";

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

/** "2026-09" → "Sep 2026" */
export function formatMonth(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return `${SHORT_MONTHS[mon - 1]} ${year}`;
}

/** "Sep 2026 – Okt 2026", atau satu bulan saja bila sama. */
export function formatMonthRange(from: string, to: string) {
  return from === to
    ? formatMonth(from)
    : `${formatMonth(from)} – ${formatMonth(to)}`;
}

export function Section({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className={`${cardClass} p-5`}>
      <header className="mb-4 flex gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
          {step}
        </span>
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          {hint && (
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {hint}
            </p>
          )}
        </div>
      </header>
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1.5 block font-medium text-gray-700 dark:text-gray-300">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
          {hint}
        </span>
      )}
    </label>
  );
}
