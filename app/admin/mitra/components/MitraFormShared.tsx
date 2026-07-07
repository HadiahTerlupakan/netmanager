import type { ReactNode } from "react";

export const INPUT_CLASS =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent";

export const TEKNISI_RATE_INPUT_CLASS =
  "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white";

export function FormSectionDivider({
  label,
}: {
  readonly label: string;
}): ReactNode {
  return (
    <div className="md:col-span-2">
      <div className="border-t border-gray-200 dark:border-gray-700 my-2 pt-3">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          {label}
        </h4>
      </div>
    </div>
  );
}

export interface FieldLabelProps {
  readonly children: ReactNode;
}

export function FieldLabel({ children }: FieldLabelProps): ReactNode {
  return (
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      {children}
    </label>
  );
}

export function FieldError({
  message,
}: {
  readonly message?: string;
}): ReactNode {
  if (!message) return null;
  return (
    <p className="text-sm font-medium text-red-600 dark:text-red-400 mt-1">
      {message}
    </p>
  );
}
