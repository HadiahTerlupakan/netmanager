"use client";

import { HiOutlineArrowDownTray } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { cardClass } from "./ui";

export function GenerateSummary(props: {
  rows: Array<[string, string]>;
  pdfCount: number;
  missing: string[];
  problem: string | null;
  ready: boolean;
  submitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <aside className={`${cardClass} space-y-4 p-5 lg:sticky lg:top-6`}>
      <h2 className="font-semibold text-gray-900 dark:text-white">Ringkasan</h2>
      <dl className="space-y-2 text-sm">
        {props.rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
            <dd className="text-right font-medium text-gray-900 dark:text-gray-100">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="rounded-lg bg-indigo-50 px-4 py-3 dark:bg-indigo-900/30">
        <p className="text-xs text-indigo-700 dark:text-indigo-300">
          Jumlah PDF
        </p>
        <p
          data-summary="pdf"
          className="text-2xl font-semibold tabular-nums text-indigo-900 dark:text-white"
        >
          {props.pdfCount.toLocaleString("id-ID")}
        </p>
      </div>
      {props.problem && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
        >
          {props.problem}
        </p>
      )}
      {!props.problem && props.missing.length > 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <p>Lengkapi dulu:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {props.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      <Button
        type="button"
        variant="primary"
        className="w-full"
        disabled={!props.ready}
        loading={props.submitting}
        onClick={props.onSubmit}
      >
        {!props.submitting && <HiOutlineArrowDownTray />}
        {props.submitting ? "Memproses…" : "Generate & unduh ZIP"}
      </Button>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Setiap PDF bertanda CONTOH dan tidak tercatat di billing maupun
        pembukuan.
      </p>
    </aside>
  );
}
