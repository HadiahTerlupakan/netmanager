"use client";

import { HiOutlineXMark } from "react-icons/hi2";
import type { LegalFormValues } from "./legal-form-state";
import { FormField, INPUT_CLASS, type UpdateLegalField } from "./form-fields";
import PartyPicker from "./PartyPicker";

/**
 * Pihak / penerbit: teks bebas (mis. instansi penerbit izin) atau tertaut ke
 * data mitra, reseller, pelanggan, vendor, atau site — yang tertaut tampil
 * sebagai tautan di detail dokumen.
 */

const PARTY_TYPE_OPTIONS = [
  { value: "", label: "Teks bebas" },
  { value: "MITRA", label: "Mitra" },
  { value: "RESELLER", label: "Reseller" },
  { value: "PELANGGAN", label: "Pelanggan" },
  { value: "VENDOR", label: "Vendor" },
  { value: "SITE", label: "Site" },
] as const;

export default function PartyField({
  values,
  onChange,
}: {
  values: LegalFormValues;
  onChange: UpdateLegalField;
}) {
  const typeLabel =
    PARTY_TYPE_OPTIONS.find((option) => option.value === values.partyType)?.label ?? "";
  const changeType = (next: string) => {
    onChange("partyType", next);
    onChange("partyId", "");
    if (next) onChange("partyName", "");
  };

  return (
    <FormField label="Pihak / penerbit">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={values.partyType}
          onChange={(event) => changeType(event.target.value)}
          className={`${INPUT_CLASS} sm:w-40`}
          aria-label="Jenis pihak"
        >
          {PARTY_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="flex-1">
          {!values.partyType && (
            <input
              type="text"
              value={values.partyName}
              onChange={(event) => onChange("partyName", event.target.value)}
              className={INPUT_CLASS}
              placeholder="PT Mitra Tower / Dinas PMPTSP"
              aria-label="Nama pihak"
            />
          )}
          {values.partyType && values.partyId && (
            <div className="flex items-center justify-between rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600">
              <span className="text-gray-900 dark:text-white">{values.partyName}</span>
              <button
                type="button"
                onClick={() => onChange("partyId", "")}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                aria-label="Ganti pihak"
              >
                <HiOutlineXMark className="h-4 w-4" />
              </button>
            </div>
          )}
          {values.partyType && !values.partyId && (
            <PartyPicker
              partyType={values.partyType}
              typeLabel={typeLabel}
              onSelect={(party) => {
                onChange("partyId", party.id);
                onChange("partyName", party.name);
              }}
            />
          )}
        </div>
      </div>
    </FormField>
  );
}
