"use client";

import { useState } from "react";
import { HiOutlinePencilSquare } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";
import { ConfidentialBadge, NeutralBadge } from "../components/LegalBadges";
import { jsonRequest, sendLegalRequest } from "../components/legal-request";
import { LEGAL_CATEGORIES_URL } from "../components/useLegalCategories";
import type { LegalCategory } from "../components/legal-types";
import ActiveSwitch from "../components/ActiveSwitch";

/** Tabel kategori satu jenis dokumen: nama, kerahasiaan, status aktif, ubah. */
export default function CategoryTable({
  title,
  categories,
  onEdit,
  onChanged,
}: {
  title: string;
  categories: LegalCategory[];
  onEdit: (category: LegalCategory) => void;
  onChanged: () => void;
}) {
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const toggleActive = async (category: LegalCategory) => {
    setTogglingId(category.id);
    const updated = await sendLegalRequest<LegalCategory>(
      `${LEGAL_CATEGORIES_URL}/${category.id}`,
      jsonRequest("PATCH", { isActive: !category.isActive }),
      "Gagal mengubah status kategori",
    );
    setTogglingId(null);
    if (updated) onChanged();
  };

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <h2 className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
        {title}
        <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
          {categories.length} kategori
        </span>
      </h2>
      {categories.length === 0 ? (
        <p className="p-4 text-sm text-gray-500 dark:text-gray-400">Belum ada kategori.</p>
      ) : (
        // Lebar kolom dikunci (table-fixed) supaya kolom keempat tabel jenis sejajar.
        <table className="w-full table-fixed text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
            <tr>
              <th className="px-4 py-2 font-medium">Nama</th>
              <th className="w-40 px-4 py-2 font-medium">Kerahasiaan</th>
              <th className="w-28 px-4 py-2 font-medium">Aktif</th>
              <th className="w-28 px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {categories.map((category) => (
              <tr key={category.id} className={category.isActive ? "" : "opacity-60"}>
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {category.name}
                  </span>
                  {category.isBuiltIn && (
                    <span className="ml-2">
                      <NeutralBadge>Bawaan</NeutralBadge>
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {category.confidentiality === "RAHASIA" ? (
                    <ConfidentialBadge />
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">Biasa</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <ActiveSwitch
                    isOn={category.isActive}
                    isDisabled={togglingId === category.id}
                    label={`${category.isActive ? "Nonaktifkan" : "Aktifkan"} ${category.name}`}
                    onToggle={() => void toggleActive(category)}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => onEdit(category)}>
                    <HiOutlinePencilSquare />
                    Ubah
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
