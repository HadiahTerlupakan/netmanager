import { useLegalCategories } from "../useLegalCategories";
import type { LegalFormValues } from "./legal-form-state";
import {
  CollapsibleSection,
  FormField,
  INPUT_CLASS,
  type UpdateLegalField,
} from "./form-fields";
import PartyField from "./PartyField";
import PicPicker from "./PicPicker";

/** Seksi "Detail tambahan": nomor, kategori, pihak (teks atau tertaut), tanggal mulai, PIC. */
export default function DetailFields({
  values,
  onChange,
}: {
  values: LegalFormValues;
  onChange: UpdateLegalField;
}) {
  const { categories } = useLegalCategories();
  const categoryOptions = categories.filter(
    (category) =>
      category.documentType === values.documentType &&
      (category.isActive || category.id === values.categoryId),
  );

  return (
    <CollapsibleSection title="Detail tambahan">
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
          <select
            value={values.categoryId}
            onChange={(event) => onChange("categoryId", event.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">Tanpa kategori</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
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
