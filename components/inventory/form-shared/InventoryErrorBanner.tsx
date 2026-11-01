"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { FiAlertTriangle, FiX } from "react-icons/fi";

interface InventoryErrorBannerProps {
  /** Pesan dari server atau form; satu masalah per baris. */
  message: string;
  /** Judul singkat, mis. "Barang belum tersimpan". */
  title?: string;
  /** Isi tambahan di bawah pesan, mis. daftar kolom yang salah. */
  children?: ReactNode;
  /** Tombol atau tautan langkah berikutnya, mis. "Muat ulang". */
  action?: ReactNode;
  onClose?: () => void;
  className?: string;
}

/**
 * Kotak merah untuk masalah di layar inventory. Menggulir dirinya ke layar
 * setiap pesannya berubah — tombol simpan sering jauh di bawah, dan tanpa itu
 * staf mengira tombolnya tidak bekerja. Dibacakan pembaca layar
 * (`role="alert"`) dan menampilkan satu masalah per baris.
 */
export function InventoryErrorBanner({
  message,
  title,
  children,
  action,
  onClose,
  className = "",
}: InventoryErrorBannerProps) {
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (message) {
      bannerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [message]);

  if (!message) return null;
  return (
    <div
      ref={bannerRef}
      role="alert"
      className={`flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300 ${className}`}
    >
      <FiAlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <p className={`whitespace-pre-line ${title ? "mt-1" : ""}`}>
          {message}
        </p>
        {children}
        {action && <div className="mt-2">{action}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup pesan"
          className="shrink-0 rounded p-1 hover:bg-red-100 dark:hover:bg-red-900/40"
        >
          <FiX className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
