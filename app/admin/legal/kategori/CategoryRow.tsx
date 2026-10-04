"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { INPUT_CLASS } from "../components/form/form-fields";
import { ConfidentialBadge, NeutralBadge } from "../components/LegalBadges";
import { MIN_CATEGORY_NAME_LENGTH } from "../components/legal-format";
import { jsonRequest, sendLegalRequest } from "../components/legal-request";
import { LEGAL_CATEGORIES_URL } from "../components/useLegalCategories";
import type { LegalCategory } from "../components/legal-types";

/** Satu kategori: ganti nama di tempat, tukar Rahasia/Biasa, dan Aktif/Nonaktif. */

type CategoryPatch = Partial<
  Pick<LegalCategory, "name" | "confidentiality" | "isActive">
>;

export default function CategoryRow({
  category,
  onChanged,
}: {
  category: LegalCategory;
  onChanged: () => void;
}) {
  const [draftName, setDraftName] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isConfidential = category.confidentiality === "RAHASIA";

  const save = async (patch: CategoryPatch) => {
    setIsSaving(true);
    const updated = await sendLegalRequest<LegalCategory>(
      `${LEGAL_CATEGORIES_URL}/${category.id}`,
      jsonRequest("PATCH", patch),
      "Gagal menyimpan kategori",
    );
    setIsSaving(false);
    if (!updated) return false;

    onChanged();
    return true;
  };

  const saveName = async () => {
    const trimmed = draftName?.trim() ?? "";
    if (trimmed.length < MIN_CATEGORY_NAME_LENGTH) {
      toast.error(`Nama kategori minimal ${MIN_CATEGORY_NAME_LENGTH} karakter`);
      return;
    }
    if (await save({ name: trimmed })) setDraftName(null);
  };

  return (
    <li className="flex flex-col gap-2 border-b border-gray-100 px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700/60">
      {draftName === null ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span
            className={
              category.isActive
                ? "font-medium text-gray-900 dark:text-white"
                : "text-gray-400 line-through"
            }
          >
            {category.name}
          </span>
          {category.isBuiltIn && <NeutralBadge>Bawaan</NeutralBadge>}
          {isConfidential && <ConfidentialBadge />}
        </div>
      ) : (
        <input
          type="text"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          className={`${INPUT_CLASS} sm:max-w-xs`}
          aria-label="Nama kategori"
          autoFocus
        />
      )}

      <div className="flex flex-wrap gap-1">
        {draftName === null ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => setDraftName(category.name)}>
              Ganti nama
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={isSaving}
              onClick={() =>
                void save({ confidentiality: isConfidential ? "BIASA" : "RAHASIA" })
              }
            >
              {isConfidential ? "Jadikan biasa" : "Jadikan rahasia"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={isSaving}
              onClick={() => void save({ isActive: !category.isActive })}
            >
              {category.isActive ? "Nonaktifkan" : "Aktifkan"}
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" onClick={saveName} disabled={isSaving}>
              Simpan
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraftName(null)}>
              Batal
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
