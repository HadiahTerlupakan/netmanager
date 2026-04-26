"use client";

import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { HiOutlineCheck } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import {
  CANVASING_PACKAGE_OPTIONS,
  DEFAULT_CANVASING_FORM_VALUES,
  type CanvasingFormErrors,
  type CanvasingFormValues,
  validateCanvasingForm,
} from "@/modules/marketing/validators/canvasingValidation";

type CanvasingFormProps = {
  initialValue?: Partial<CanvasingFormValues>;
  submitLabel: string;
  processing: boolean;
  onSubmit: (values: CanvasingFormValues) => Promise<void>;
  onCancel: () => void;
};

/** Render reusable canvasing form for create and edit flows. */
export default function CanvasingForm({
  initialValue,
  submitLabel,
  processing,
  onSubmit,
  onCancel,
}: CanvasingFormProps) {
  const [formValues, setFormValues] = useState<CanvasingFormValues>({
    ...DEFAULT_CANVASING_FORM_VALUES,
    ...initialValue,
  });
  const [fieldErrors, setFieldErrors] = useState<CanvasingFormErrors>({});

  function updateField<Key extends keyof CanvasingFormValues>(
    fieldName: Key,
    fieldValue: CanvasingFormValues[Key],
  ) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [fieldName]: fieldValue,
    }));

    setFieldErrors((currentErrors) => {
      if (!currentErrors[fieldName]) {
        return currentErrors;
      }

      return {
        ...currentErrors,
        [fieldName]: undefined,
      };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationResult = validateCanvasingForm(formValues);
    if (!validationResult.isValid) {
      setFieldErrors(validationResult.errors);
      return;
    }

    setFieldErrors({});
    await onSubmit(formValues);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
    >
      <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField label="Nama Lengkap (Sesuai KTP)" error={fieldErrors.nama}>
          <input
            type="text"
            className={getInputClassName(fieldErrors.nama)}
            value={formValues.nama}
            onChange={(event) => updateField("nama", event.target.value)}
          />
        </FormField>

        <FormField label="Nomor KTP (NIK)" error={fieldErrors.noKtp}>
          <input
            type="text"
            className={getInputClassName(fieldErrors.noKtp)}
            value={formValues.noKtp}
            onChange={(event) => updateField("noKtp", event.target.value)}
          />
        </FormField>

        <FormField label="Nomor Telepon" error={fieldErrors.noTelpon}>
          <input
            type="text"
            className={getInputClassName(fieldErrors.noTelpon)}
            value={formValues.noTelpon}
            onChange={(event) => updateField("noTelpon", event.target.value)}
          />
        </FormField>

        <FormField label="Email (Opsional)" error={fieldErrors.email}>
          <input
            type="email"
            className={getInputClassName(fieldErrors.email)}
            value={formValues.email ?? ""}
            onChange={(event) => updateField("email", event.target.value)}
          />
        </FormField>

        <FormField
          label="Alamat Lengkap"
          error={fieldErrors.alamat}
          className="md:col-span-2"
        >
          <textarea
            rows={3}
            className={`${getInputClassName(fieldErrors.alamat)} resize-none`}
            value={formValues.alamat}
            onChange={(event) => updateField("alamat", event.target.value)}
          />
        </FormField>

        <FormField label="Paket Layanan" error={fieldErrors.paket}>
          <select
            className={getInputClassName(fieldErrors.paket)}
            value={formValues.paket}
            onChange={(event) => updateField("paket", event.target.value)}
          >
            {CANVASING_PACKAGE_OPTIONS.map((paketOption) => (
              <option key={paketOption.value} value={paketOption.value}>
                {paketOption.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Estimasi Kabel (Meter)" error={fieldErrors.kabel}>
          <input
            type="number"
            min={1}
            className={getInputClassName(fieldErrors.kabel)}
            value={formValues.kabel}
            onChange={(event) =>
              updateField("kabel", Number(event.target.value) || 0)
            }
          />
        </FormField>

        <FormField label="ODP Terdekat (Opsional)" error={fieldErrors.odp}>
          <input
            type="text"
            className={getInputClassName(fieldErrors.odp)}
            value={formValues.odp ?? ""}
            onChange={(event) => updateField("odp", event.target.value)}
          />
        </FormField>

        <FormField label="Serial Number (Opsional)" error={fieldErrors.sn}>
          <input
            type="text"
            className={getInputClassName(fieldErrors.sn)}
            value={formValues.sn ?? ""}
            onChange={(event) => updateField("sn", event.target.value)}
          />
        </FormField>
      </div>

      <div className="p-8 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Batal
        </Button>
        <Button type="submit" loading={processing}>
          <HiOutlineCheck className="w-5 h-5" />
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

type FormFieldProps = {
  label: string;
  error?: string;
  className?: string;
  children: ReactNode;
};

function FormField({ label, error, className, children }: FormFieldProps) {
  return (
    <div className={`space-y-2 ${className ?? ""}`.trim()}>
      <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}

function getInputClassName(error?: string): string {
  const errorClassName = error
    ? "border-red-500 focus:ring-red-500"
    : "border-gray-200 dark:border-gray-700 focus:ring-indigo-500";

  return [
    "w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 dark:text-white rounded-lg",
    "border outline-none transition-all focus:ring-2",
    errorClassName,
  ].join(" ");
}
