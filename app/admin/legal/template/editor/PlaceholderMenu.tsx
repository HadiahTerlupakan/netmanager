"use client";

import { INPUT_CLASS } from "../../components/form/form-fields";
import type { TemplatePlaceholder } from "../../components/legal-types";
import { placeholderToken } from "./template-blocks";

/**
 * Pilihan "Sisipkan isian": memilih satu isian langsung menyisipkannya ke
 * kotak teks yang terakhir difokus, lalu pilihan kembali kosong.
 */
export default function PlaceholderMenu({
  placeholders,
  isEnabled,
  onInsert,
}: {
  placeholders: TemplatePlaceholder[];
  /** False sampai ada kotak teks blok yang pernah difokus. */
  isEnabled: boolean;
  onInsert: (key: string) => void;
}) {
  return (
    <select
      value=""
      onChange={(event) => {
        if (event.target.value) onInsert(event.target.value);
      }}
      disabled={!isEnabled || placeholders.length === 0}
      className={`${INPUT_CLASS} sm:w-64`}
      aria-label="Sisipkan isian"
      title={isEnabled ? undefined : "Klik dulu kotak teks blok tujuan"}
    >
      <option value="">Sisipkan isian…</option>
      {placeholders.map((placeholder) => (
        <option key={placeholder.key} value={placeholder.key}>
          {placeholder.label} — {placeholderToken(placeholder.key)}
        </option>
      ))}
    </select>
  );
}
