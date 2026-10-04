"use client";

import { HiOutlineArrowPath, HiOutlineDocumentText } from "react-icons/hi2";
import { Button } from "@/components/ui/Button";

/** Panel pratinjau PDF (iframe) dengan tombol "Perbarui pratinjau". */
export default function PreviewPanel({
  previewUrl,
  isLoading,
  error,
  onRefresh,
}: {
  previewUrl: string | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}) {
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 lg:sticky lg:top-4">
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-2 dark:border-gray-700">
        <h2 className="font-semibold text-gray-900 dark:text-white">Pratinjau PDF</h2>
        <Button size="sm" variant="outline" onClick={onRefresh} loading={isLoading}>
          {!isLoading && <HiOutlineArrowPath />}
          Perbarui pratinjau
        </Button>
      </div>
      {error && (
        <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}
      {previewUrl ? (
        <iframe
          src={previewUrl}
          title="Pratinjau PDF template"
          className="h-[60vh] w-full bg-gray-100 lg:h-[78vh]"
        />
      ) : (
        <div className="flex h-64 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <HiOutlineDocumentText className="h-8 w-8" />
          {isLoading
            ? "Menyusun pratinjau…"
            : "Klik “Perbarui pratinjau” untuk melihat hasil PDF."}
        </div>
      )}
    </section>
  );
}
