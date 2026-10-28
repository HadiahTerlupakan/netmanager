"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { SampleInvoiceLimits } from "@/modules/sample-invoice";

const FIELDS: Array<[keyof SampleInvoiceLimits, string]> = [
  ["maxCustomers", "Maksimal pelanggan per generate"],
  ["maxMonths", "Maksimal rentang bulan"],
  ["maxPdfs", "Maksimal PDF per generate"],
];

export function LimitsPanel({
  limits,
  onSaved,
}: {
  limits: SampleInvoiceLimits;
  onSaved: (limits: SampleInvoiceLimits) => void;
}) {
  const { showToast } = useToast();
  const [values, setValues] = useState(limits);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/sample-invoices/limits", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await response.json();
      if (!response.ok)
        return showToast("error", body.error ?? "Gagal menyimpan batas");
      onSaved(body.data);
      showToast("success", "Batas disimpan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="rounded-lg border p-4 dark:border-gray-700">
      <summary className="cursor-pointer text-sm font-semibold">
        Pengaturan batas
      </summary>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        {FIELDS.map(([key, label]) => (
          <label key={key} className="text-sm">
            {label}
            <input
              className="w-full rounded border px-2 py-1 text-sm dark:bg-gray-900"
              inputMode="numeric"
              value={values[key]}
              onChange={(e) =>
                setValues({
                  ...values,
                  [key]: Number(e.target.value.replace(/\D/g, "")),
                })
              }
            />
          </label>
        ))}
        <button
          type="button"
          className="self-end rounded bg-gray-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          disabled={saving}
          onClick={save}
        >
          Simpan
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Generate yang lebih dari 2.000 PDF tetap boleh; unduhannya dipecah per
        bulan.
      </p>
    </details>
  );
}
