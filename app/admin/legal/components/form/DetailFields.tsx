import type { LegalFormValues } from "./legal-form-state";
import {
  CollapsibleSection,
  FormField,
  INPUT_CLASS,
  type UpdateLegalField,
} from "./form-fields";
import CategorySelect from "./CategorySelect";
import PartyField from "./PartyField";
import PicPicker from "./PicPicker";

/** Seksi "Detail tambahan": nomor, kategori, pihak (teks atau tertaut), tanggal mulai, PIC. */
export default function DetailFields({
  values,
  onChange,
  isInitiallyOpen = false,
}: {
  values: LegalFormValues;
  onChange: UpdateLegalField;
  isInitiallyOpen?: boolean;
}) {
  return (
    <CollapsibleSection title="Detail tambahan" isInitiallyOpen={isInitiallyOpen}>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Nomor dokumen">
          <input
            type="text"
            value={values.documentNumber}
            onChange={(event) => onChange("documentNumber", event.target.value)}
            className={INPUT_CLASS}
          />
        </FormField>
        <FormField label="Kategori">
          <CategorySelect
            documentType={values.documentType}
            value={values.categoryId}
            onChange={(categoryId) => onChange("categoryId", categoryId)}
          />
        </FormField>
      </div>

      <PartyField values={values} onChange={onChange} />

      <FormField label="Tanggal mulai">
        <input
          type="date"
          value={values.startDate}
          onChange={(event) => onChange("startDate", event.target.value)}
          className={`${INPUT_CLASS} sm:max-w-xs`}
        />
      </FormField>

      <FormField label="PIC">
        <PicPicker
          selected={
            values.picUserId
              ? { userId: values.picUserId, name: values.picName }
              : null
          }
          onChange={(pic) => {
            onChange("picUserId", pic?.userId ?? "");
            onChange("picName", pic?.name ?? "");
          }}
        />
      </FormField>
    </CollapsibleSection>
  );
}
