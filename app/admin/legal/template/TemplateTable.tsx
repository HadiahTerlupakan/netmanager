"use client";

import Link from "next/link";
import { useState } from "react";
import { HiOutlineDocumentPlus, HiOutlinePencilSquare } from "react-icons/hi2";
import { buttonVariants } from "@/components/ui/Button";
import ActiveSwitch from "../components/ActiveSwitch";
import { NeutralBadge } from "../components/LegalBadges";
import { jsonRequest, sendLegalRequest } from "../components/legal-request";
import type { LegalTemplate } from "../components/legal-types";
import {
  LEGAL_TEMPLATES_URL,
  templateEditorPath,
  templateUsePath,
} from "./useLegalTemplates";

/** Tabel template satu jenis dokumen: nama, kategori, status aktif, ubah, dan pakai. */
export default function TemplateTable({
  title,
  templates,
  onChanged,
}: {
  title: string;
  templates: LegalTemplate[];
  onChanged: () => void;
}) {
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const toggleActive = async (template: LegalTemplate) => {
    setTogglingId(template.id);
    const updated = await sendLegalRequest<LegalTemplate>(
      `${LEGAL_TEMPLATES_URL}/${template.id}`,
      jsonRequest("PATCH", { isActive: !template.isActive }),
      "Gagal mengubah status template",
    );
    setTogglingId(null);
    if (updated) onChanged();
  };

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <h2 className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
        {title}
        <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
          {templates.length} template
        </span>
      </h2>
      {templates.length === 0 ? (
        <p className="p-4 text-sm text-gray-500 dark:text-gray-400">Belum ada template.</p>
      ) : (
        <div className="overflow-x-auto">
          {/* Lebar kolom dikunci (table-fixed) supaya kolom tabel antarjenis sejajar. */}
          <table className="w-full min-w-[40rem] table-fixed text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-gray-900/40 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2 font-medium">Nama</th>
                <th className="w-48 px-4 py-2 font-medium">Kategori</th>
                <th className="w-24 px-4 py-2 font-medium">Aktif</th>
                <th className="w-48 px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60">
              {templates.map((template) => (
                <tr key={template.id} className={template.isActive ? "" : "opacity-60"}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {template.name}
                    </span>
                    {template.isBuiltIn && (
                      <span className="ml-2">
                        <NeutralBadge>Bawaan</NeutralBadge>
                      </span>
                    )}
                  </td>
                  <td className="truncate px-4 py-3 text-gray-600 dark:text-gray-300">
                    {template.category?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ActiveSwitch
                      isOn={template.isActive}
                      isDisabled={togglingId === template.id}
                      label={`${template.isActive ? "Nonaktifkan" : "Aktifkan"} ${template.name}`}
                      onToggle={() => void toggleActive(template)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Link
                        href={templateEditorPath(template.id)}
                        className={buttonVariants({ size: "sm", variant: "ghost" })}
                      >
                        <HiOutlinePencilSquare />
                        Ubah
                      </Link>
                      {template.isActive && (
                        <Link
                          href={templateUsePath(template.id)}
                          className={buttonVariants({ size: "sm", variant: "outline" })}
                        >
                          <HiOutlineDocumentPlus />
                          Pakai
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
