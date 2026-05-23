"use client";

import { forwardRef } from "react";

import { PhotoUpload, type PhotoUploadRef } from "../PhotoUpload";

import type { UploadedPhotoState } from "./useFotoBuktiUpload";

export type FotoTransactionType =
  | "inventory-masuk"
  | "inventory-keluar"
  | "inventory-transfer"
  | "finance-transaction";

interface FotoBuktiSectionProps {
  transactionId: string | null;
  fallbackId: string;
  transactionType: FotoTransactionType;
  onPhotosChange: (photos: UploadedPhotoState[]) => void;
  isEditMode?: boolean;
  hideWhileNoTransaction?: boolean;
  loading?: boolean;
  maxPhotos?: number;
  maxSizeMB?: number;
}

/**
 * Section untuk upload foto bukti di form inventory.
 * Wrap PhotoUpload + label + helper text + edit-mode banner.
 */
export const FotoBuktiSection = forwardRef<
  PhotoUploadRef,
  FotoBuktiSectionProps
>(function FotoBuktiSection(
  {
    transactionId,
    fallbackId,
    transactionType,
    onPhotosChange,
    isEditMode,
    hideWhileNoTransaction,
    loading,
    maxPhotos = 5,
    maxSizeMB = 5,
  },
  ref,
) {
  if (isEditMode && hideWhileNoTransaction && !transactionId) {
    return (
      <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
        <p className="text-sm text-yellow-800">
          <strong>Perhatian:</strong> Data transaksi sedang dimuat. Foto dapat
          ditambahkan setelah data tersedia.
        </p>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Foto Barang (Opsional)
      </label>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        {isEditMode
          ? `Tambah foto barang untuk dokumentasi (maksimal ${maxPhotos} foto)`
          : `Upload foto barang untuk dokumentasi (maksimal ${maxPhotos} foto)`}
      </p>
      {isEditMode && (
        <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Mode Edit:</strong> Anda dapat menambahkan foto baru untuk
            transaksi ini.
          </p>
        </div>
      )}
      <PhotoUpload
        ref={ref}
        transactionId={transactionId || fallbackId}
        transactionType={transactionType}
        onPhotosChange={onPhotosChange}
        maxPhotos={maxPhotos}
        maxSizeMB={maxSizeMB}
        disabled={loading}
        className="border border-gray-200 dark:border-gray-600 rounded-lg"
      />
    </div>
  );
});
