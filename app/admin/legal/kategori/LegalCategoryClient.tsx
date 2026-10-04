"use client";

import Link from "next/link";
import { useState } from "react";
import { HiOutlineArrowLeft, HiOutlinePlus, HiOutlineTag } from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import { Button } from "@/components/ui/Button";
import { DOCUMENT_TYPE_LABEL } from "../components/legal-format";
import {
  LEGAL_DOCUMENT_TYPES,
  type LegalCategory,
} from "../components/legal-types";
import { useLegalCategories } from "../components/useLegalCategories";
import CategoryFormModal from "./CategoryFormModal";
import CategoryTable from "./CategoryTable";

/** Kelola kategori legal per jenis dokumen: tambah dan ubah lewat modal, aktif lewat sakelar. */

type FormState = { mode: "create" } | { mode: "edit"; category: LegalCategory };

export default function LegalCategoryClient() {
  const { categories, error, isLoading, mutate } = useLegalCategories();
  const [form, setForm] = useState<FormState | null>(null);
  const refresh = (): void => {
    void mutate();
  };

  if (isLoading) return <PageLoader />;

  if (error) {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        Gagal memuat kategori legal.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/legal"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <HiOutlineArrowLeft className="h-4 w-4" />
            Dasbor legal
          </Link>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <HiOutlineTag className="h-6 w-6" />
            Kategori Legal
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Pengelompokan dokumen legal. Kategori rahasia hanya terlihat oleh
            pengguna dengan izin Legal Rahasia.
          </p>
        </div>
        <Button onClick={() => setForm({ mode: "create" })}>
          <HiOutlinePlus />
          Tambah kategori
        </Button>
      </div>

      <div className="space-y-4">
        {LEGAL_DOCUMENT_TYPES.map((type) => (
          <CategoryTable
            key={type}
            title={DOCUMENT_TYPE_LABEL[type]}
            categories={categories.filter((category) => category.documentType === type)}
            onEdit={(category) => setForm({ mode: "edit", category })}
            onChanged={refresh}
          />
        ))}
      </div>

      {form && (
        <CategoryFormModal
          category={form.mode === "edit" ? form.category : undefined}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
