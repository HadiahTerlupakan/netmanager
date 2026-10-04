import type { LegalFormMode, LegalFormValues } from "./legal-form-state";
import { FormField, INPUT_CLASS, type UpdateLegalField } from "./form-fields";

/**
 * Masa berlaku: tanggal berakhir, atau tanpa batas waktu untuk dokumen yang
 * tidak kedaluwarsa (NIB, akta). Saat perpanjangan selalu wajib bertanggal.
 */
export default function ValidityField({
  mode,
  values,
  onChange,
}: {
  mode: LegalFormMode;
  values: LegalFormValues;
  onChange: UpdateLegalField;
}) {
  if (mode === "renew") {
    return (
      <FormField label="Berlaku sampai (baru)">
        <input
          type="date"
          value={values.endDate}
          onChange={(event) => onChange("endDate", event.target.value)}
          className={INPUT_CLASS}
        />
      </FormField>
    );
  }

  return (
    <FormField
      label="Berlaku sampai"
      hint={
        values.isIndefinite
          ? "Tanpa pengingat masa berlaku. Pengingat kewajiban berkala (mis. laporan) tetap berjalan."
          : "Pengingat dikirim 90, 30, dan 7 hari sebelum tanggal ini."
      }
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="date"
          value={values.isIndefinite ? "" : values.endDate}
          onChange={(event) => onChange("endDate", event.target.value)}
          disabled={values.isIndefinite}
          className={`${INPUT_CLASS} sm:max-w-xs`}
          aria-label="Tanggal berakhir"
        />
        <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={values.isIndefinite}
            onChange={(event) => {
              onChange("isIndefinite", event.target.checked);
              if (event.target.checked) onChange("endDate", "");
            }}
            aria-label="Berlaku tanpa batas waktu"
          />
          Berlaku tanpa batas waktu
        </span>
      </div>
    </FormField>
  );
}
