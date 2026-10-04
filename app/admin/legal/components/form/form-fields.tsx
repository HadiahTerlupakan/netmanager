import type { ReactNode } from "react";
import type { LegalFormValues } from "./legal-form-state";

/** Primitif tampilan formulir legal: kelas input, pembungkus field, seksi lipat. */

export const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-700 dark:text-white";

/** Pengubah satu isian formulir, dipakai bersama oleh seluruh seksi. */
export type UpdateLegalField = <K extends keyof LegalFormValues>(
  key: K,
  value: LegalFormValues[K],
) => void;

/** Label + kontrol + teks bantuan opsional. */
export function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
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

/** Seksi yang bisa dibuka-tutup untuk isian opsional. */
export function CollapsibleSection({
  title,
  isInitiallyOpen = false,
  children,
}: {
  title: string;
  isInitiallyOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={isInitiallyOpen}
      className="rounded-lg border border-gray-200 dark:border-gray-700"
    >
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-gray-800 dark:text-gray-200">
        {title}
      </summary>
      <div className="space-y-3 border-t border-gray-200 p-3 dark:border-gray-700">
        {children}
      </div>
    </details>
  );
}
