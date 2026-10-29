"use client";

import { useState } from "react";
import { HiOutlineChevronDown } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { SampleInvoiceLimits } from "@/modules/sample-invoice";
import { cardClass, Field, inputClass } from "./ui";

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
    <details className={`${cardClass} group`}>
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-semibold text-gray-900 dark:text-white">
        Pengaturan batas
        <HiOutlineChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-gray-200 px-5 py-4 dark:border-gray-700">
        <div className="grid items-end gap-4 md:grid-cols-[1fr_1fr_1fr_auto]">
          {FIELDS.map(([key, label]) => (
            <Field key={key} label={label}>
              <input
                className={`${inputClass} tabular-nums`}
                inputMode="numeric"
                value={values[key]}
                onChange={(e) =>
                  setValues({
                    ...values,
                    [key]: Number(e.target.value.replace(/\D/g, "")),
                  })
                }
              />
            </Field>
          ))}
          <Button
            type="button"
            variant="primary"
            loading={saving}
            onClick={save}
          >
            Simpan
          </Button>
        </div>
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Generate yang lebih dari 2.000 PDF tetap boleh; unduhannya dipecah per
          bulan.
        </p>
      </div>
    </details>
  );
}
