import { useLegalCategories } from "../useLegalCategories";
import type { LegalFormMode, LegalFormValues } from "./legal-form-state";
import {
  CollapsibleSection,
  FormField,
  INPUT_CLASS,
  type UpdateLegalField,
} from "./form-fields";
import PicPicker from "./PicPicker";

/** Seksi "Detail tambahan": nomor, kategori, pihak, masa berlaku, PIC. */
export default function DetailFields({
  mode,
  values,
  onChange,
}: {
  mode: LegalFormMode;
  values: LegalFormValues;
  onChange: UpdateLegalField;
}) {
  const { categories } = useLegalCategories();
  const categoryOptions = categories.filter(
    (category) =>
      category.documentType === values.documentType &&
      (category.isActive || category.id === values.categoryId),
  );
  const isRenewal = mode === "renew";

  return (
    <CollapsibleSection title="Detail tambahan" isInitiallyOpen={isRenewal}>
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

      <FormField label="Pihak / penerbit">
        <input
          type="text"
          value={values.partyName}
          onChange={(event) => onChange("partyName", event.target.value)}
          className={INPUT_CLASS}
          placeholder="PT Mitra Tower / Dinas PMPTSP"
        />
      </FormField>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Tanggal mulai">
          <input
            type="date"
            value={values.startDate}
            onChange={(event) => onChange("startDate", event.target.value)}
            className={INPUT_CLASS}
          />
        </FormField>
        <FormField
          label={isRenewal ? "Tanggal berakhir baru (wajib)" : "Tanggal berakhir"}
        >
          <input
            type="date"
            value={values.endDate}
            onChange={(event) => onChange("endDate", event.target.value)}
            className={INPUT_CLASS}
          />
        </FormField>
      </div>

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
