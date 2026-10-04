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

/** Isian inti: judul, jenis (terkunci saat ubah/perpanjang), masa berlaku, dan berkas. */
export default function RequiredFields({
  mode,
  values,
  onChange,
  onFileChange,
}: {
  mode: LegalFormMode;
  values: LegalFormValues;
  onChange: UpdateLegalField;
  onFileChange: (file: File | null) => void;
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
          disabled={mode !== "create"}
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

      {mode !== "edit" && (
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
