"use client";

import { inputClass } from "./ui";

type PayMode = "random" | "fixed";

export function PayDateField(props: {
  mode: PayMode;
  day: string;
  onModeChange: (mode: PayMode) => void;
  onDayChange: (day: string) => void;
}) {
  return (
    <fieldset className="mt-4 text-sm">
      <legend className="mb-1.5 font-medium text-gray-700 dark:text-gray-300">
        Tanggal bayar
      </legend>
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-gray-300 p-0.5 dark:border-gray-600">
          {(
            [
              ["random", "Acak dalam bulan"],
              ["fixed", "Seragam"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={props.mode === mode}
              className={`rounded-md px-3 py-1.5 ${
                props.mode === mode
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
              onClick={() => props.onModeChange(mode)}
            >
              {label}
            </button>
          ))}
        </div>
        {props.mode === "fixed" && (
          <label className="flex items-center gap-2">
            <span className="text-gray-600 dark:text-gray-300">
              setiap tanggal
            </span>
            <input
              name="payDay"
              type="number"
              min={1}
              max={28}
              className={`${inputClass} w-20`}
              value={props.day}
              onChange={(e) => props.onDayChange(e.target.value)}
            />
          </label>
        )}
      </div>
    </fieldset>
  );
}
