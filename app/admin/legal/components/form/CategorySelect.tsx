"use client";

import { useLegalCategories } from "../useLegalCategories";
import { INPUT_CLASS } from "./form-fields";

/**
 * Pilihan kategori untuk satu jenis dokumen. Kategori nonaktif disembunyikan,
 * kecuali yang sedang terpilih agar nilai lama tetap terlihat.
 */
export default function CategorySelect({
  documentType,
  value,
  onChange,
}: {
  documentType: string;
  value: string;
  onChange: (categoryId: string) => void;
}) {
  const { categories } = useLegalCategories();
  const options = categories.filter(
    (category) =>
      category.documentType === documentType &&
      (category.isActive || category.id === value),
  );

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={INPUT_CLASS}
    >
      <option value="">Tanpa kategori</option>
      {options.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </select>
  );
}
