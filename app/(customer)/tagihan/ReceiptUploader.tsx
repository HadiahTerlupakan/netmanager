"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { MdCheckCircle, MdPhotoCamera } from "react-icons/md";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

// Batas yang sama dengan server; ditolak di sini agar pelanggan tidak
// menunggu unggahan yang pasti gagal di jaringan HP.
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const RECEIPT_ACCEPT = "image/*";

type Props = {
  invoiceId: string;
  hasReceipt: boolean;
  onUploaded: () => Promise<unknown>;
};

/**
 * Unggah bukti transfer manual, dari galeri atau langsung dari kamera HP.
 * Selama belum diverifikasi admin, bukti yang sudah terkirim bisa diganti;
 * server memasangnya ke semua payment dalam checkout yang sama.
 */
export function ReceiptUploader({ invoiceId, hasReceipt, onUploaded }: Props) {
  const { showToast } = useToast();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadReceipt = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Dikosongkan agar memilih berkas yang sama lagi tetap memicu onChange.
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_RECEIPT_BYTES) {
      showToast("error", "Ukuran foto bukti transfer maksimal 5 MB.");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("invoiceId", invoiceId);
      formData.append("file", file);
      const res = await fetch("/api/customer/payments/upload-receipt", {
        method: "POST",
        body: formData,
      });
      const result = (await res.json().catch((): null => null)) as {
        success?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !result?.success) {
        showToast(
          "error",
          result?.error || "Gagal mengunggah bukti pembayaran",
        );
        return;
      }
      showToast(
        "success",
        hasReceipt
          ? "Bukti transfer diganti. Menunggu verifikasi admin."
          : "Bukti pembayaran terkirim. Menunggu verifikasi admin.",
      );
      await onUploaded();
    } catch {
      showToast("error", "Terjadi kesalahan saat mengunggah bukti pembayaran");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mt-4">
      {hasReceipt ? (
        <div className="p-3 bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 rounded-lg flex flex-col items-center">
          <MdCheckCircle className="text-teal-600 dark:text-teal-400 text-3xl mb-2" />
          <p className="font-bold text-teal-800 dark:text-teal-300 text-sm">
            Menunggu Verifikasi Admin
          </p>
          <p className="text-teal-600 dark:text-teal-400 text-xs text-center mt-1">
            Bukti transfer Anda sedang direview. Proses ini dapat memakan waktu
            beberapa saat pada jam kerja. Salah kirim bukti? Ganti sebelum
            diverifikasi.
          </p>
        </div>
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Silakan unggah bukti transfer setelah melakukan pembayaran.
        </p>
      )}
      <input
        ref={galleryInputRef}
        type="file"
        accept={RECEIPT_ACCEPT}
        className="hidden"
        tabIndex={-1}
        onChange={uploadReceipt}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept={RECEIPT_ACCEPT}
        capture="environment"
        className="hidden"
        tabIndex={-1}
        onChange={uploadReceipt}
      />
      <div className="mt-3 flex flex-col gap-2">
        <Button
          variant={hasReceipt ? "outline" : "success"}
          className="w-full"
          onClick={() => galleryInputRef.current?.click()}
          loading={isUploading}
        >
          {isUploading
            ? "Mengunggah..."
            : hasReceipt
              ? "Ganti Bukti Transfer"
              : "Unggah Bukti Transfer"}
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => cameraInputRef.current?.click()}
          disabled={isUploading}
        >
          <MdPhotoCamera aria-hidden="true" /> Ambil Foto
        </Button>
      </div>
    </div>
  );
}
