import { PAYMENT_SCHEME_LABEL } from "../legal-format";
import { LEGAL_PAYMENT_SCHEMES } from "../legal-types";
import type { LegalFormValues } from "./legal-form-state";
import {
  CollapsibleSection,
  FormField,
  INPUT_CLASS,
  type UpdateLegalField,
} from "./form-fields";

/** Seksi "Atribut legal": nilai, jaminan, perpanjangan, denda, sengketa. */
export default function LegalAttributeFields({
  values,
  onChange,
}: {
  values: LegalFormValues;
  onChange: UpdateLegalField;
}) {
  return (
    <CollapsibleSection title="Atribut legal">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Nilai (Rp)">
          <input
            type="text"
            inputMode="decimal"
            value={values.value}
            onChange={(event) => onChange("value", event.target.value)}
            className={INPUT_CLASS}
            placeholder="1.500.000"
          />
        </FormField>
        <FormField label="Skema pembayaran">
          <select
            value={values.paymentScheme}
            onChange={(event) => onChange("paymentScheme", event.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">—</option>
            {LEGAL_PAYMENT_SCHEMES.map((scheme) => (
              <option key={scheme} value={scheme}>
                {PAYMENT_SCHEME_LABEL[scheme]}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="Jaminan">
          <input
            type="text"
            value={values.guaranteeDescription}
            onChange={(event) =>
              onChange("guaranteeDescription", event.target.value)
            }
            className={INPUT_CLASS}
            placeholder="Bank garansi 5%"
          />
        </FormField>
        <FormField label="Jaminan berlaku sampai">
          <input
            type="date"
            value={values.guaranteeEndDate}
            onChange={(event) => onChange("guaranteeEndDate", event.target.value)}
            className={INPUT_CLASS}
          />
        </FormField>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input
          type="checkbox"
          checked={values.isAutoRenew}
          onChange={(event) => onChange("isAutoRenew", event.target.checked)}
        />
        Perpanjangan otomatis
      </label>

      <FormField
        label="Masa pemberitahuan (hari)"
        hint="Batas memberi tahu pihak lain sebelum tanggal berakhir (mis. 30 hari untuk tidak memperpanjang). Pengingat dikirim sebelum batas itu, bukan sebelum tanggal berakhir."
      >
        <input
          type="number"
          min={1}
          value={values.noticePeriodDays}
          onChange={(event) => onChange("noticePeriodDays", event.target.value)}
          className={INPUT_CLASS}
        />
      </FormField>

      <FormField label="Denda / penalti">
        <textarea
          rows={2}
          value={values.penaltyNotes}
          onChange={(event) => onChange("penaltyNotes", event.target.value)}
          className={INPUT_CLASS}
        />
      </FormField>
      <FormField label="Penyelesaian sengketa">
        <textarea
          rows={2}
          value={values.disputeResolution}
          onChange={(event) => onChange("disputeResolution", event.target.value)}
          className={INPUT_CLASS}
        />
      </FormField>
      <FormField label="Catatan">
        <textarea
          rows={2}
          value={values.notes}
          onChange={(event) => onChange("notes", event.target.value)}
          className={INPUT_CLASS}
        />
      </FormField>
    </CollapsibleSection>
  );
}
