"use client";

import Link from "next/link";
import { HiOutlineArrowLeft, HiOutlineTag } from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import { DOCUMENT_TYPE_LABEL } from "../components/legal-format";
import { LEGAL_DOCUMENT_TYPES } from "../components/legal-types";
import { useLegalCategories } from "../components/useLegalCategories";
import CategoryAddForm from "./CategoryAddForm";
import CategoryRow from "./CategoryRow";

/** Kelola kategori legal per jenis dokumen: tambah, ganti nama, rahasia, aktif. */
export default function LegalCategoryClient() {
  const { categories, error, isLoading, mutate } = useLegalCategories();
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
          Kategori rahasia hanya terlihat oleh pengguna dengan izin dokumen
          rahasia.
        </p>
      </div>

      <CategoryAddForm onCreated={refresh} />

      <div className="grid gap-4 lg:grid-cols-2">
        {LEGAL_DOCUMENT_TYPES.map((type) => {
          const group = categories.filter((category) => category.documentType === type);

          return (
            <section
              key={type}
              className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
            >
              <h2 className="border-b border-gray-200 px-4 py-3 font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
                {DOCUMENT_TYPE_LABEL[type]}
              </h2>
              {group.length === 0 ? (
                <p className="p-4 text-sm text-gray-500 dark:text-gray-400">
                  Belum ada kategori.
                </p>
              ) : (
                <ul>
                  {group.map((category) => (
                    <CategoryRow
                      key={category.id}
                      category={category}
                      onChanged={refresh}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
