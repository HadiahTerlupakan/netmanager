import { DOCUMENT_TYPE_LABEL } from "../legal-format";
import { LEGAL_DOCUMENT_TYPES } from "../legal-types";
import {
  ACCEPTED_FILE_TYPES,
  isIndefiniteByDefault,
  MAX_FILE_MEGABYTES,
  type LegalFormMode,
  type LegalFormValues,
} from "./legal-form-state";
import { FormField, INPUT_CLASS, type UpdateLegalField } from "./form-fields";
import ValidityField from "./ValidityField";

/**
 * Isian inti: judul, jenis (terkunci saat ubah/perpanjang atau bila dikunci
 * pemanggil), masa berlaku, dan berkas (hanya bila `onFileChange` diberikan).
 */
export default function RequiredFields({
  mode,
  values,
  onChange,
  onFileChange,
  isTypeLocked = false,
}: {
  mode: LegalFormMode;
  values: LegalFormValues;
  onChange: UpdateLegalField;
  /** Kosong = berkas disusun sistem (mis. dari template), tanpa unggahan. */
  onFileChange?: (file: File | null) => void;
  /** Jenis mengikuti sumber lain (mis. template) meski dokumen baru. */
  isTypeLocked?: boolean;
}) {
  const fileHint =
    mode === "renew"
      ? "Kosongkan untuk memakai berkas lama."
      : `PDF, PNG, atau JPG, maksimal ${MAX_FILE_MEGABYTES} MB.`;

  return (
    <div className="space-y-3">
      <FormField label="Judul">
        <input
          type="text"
          value={values.title}
          onChange={(event) => onChange("title", event.target.value)}
          className={INPUT_CLASS}
          placeholder="Kontrak sewa tower Desa Sukamaju"
        />
      </FormField>

      <FormField label="Jenis">
        <select
          value={values.documentType}
          onChange={(event) => {
            onChange("documentType", event.target.value);
            onChange("categoryId", "");
            if (!values.endDate) {
              onChange("isIndefinite", isIndefiniteByDefault(event.target.value));
            }
          }}
          disabled={mode !== "create" || isTypeLocked}
          className={INPUT_CLASS}
        >
          {LEGAL_DOCUMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {DOCUMENT_TYPE_LABEL[type]}
            </option>
          ))}
        </select>
      </FormField>

      <ValidityField mode={mode} values={values} onChange={onChange} />

      {mode !== "edit" && onFileChange && (
        <FormField
          label={mode === "renew" ? "Berkas baru (opsional)" : "Berkas"}
          hint={fileHint}
        >
          <input
            type="file"
            accept={ACCEPTED_FILE_TYPES.join(",")}
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
            className={INPUT_CLASS}
          />
        </FormField>
      )}
    </div>
  );
}
