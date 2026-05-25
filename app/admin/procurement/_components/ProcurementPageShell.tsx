"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { HiArrowLeft } from "react-icons/hi2";

interface PageHeaderAction {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
}

interface ProcurementPageShellProps {
  title: string;
  subtitle?: string;
  /** Bila diset, render tombol back ke href tersebut. */
  backHref?: string;
  /** Action tambahan di kanan header (mis. tombol "Tambah", "Buat GRN"). */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Shell standar untuk semua halaman di /admin/procurement/**.
 * Tujuan: tampilan konsisten dengan modul Inventory (max-w container,
 * `space-y-6`, header gaya `text-2xl font-bold` + subtitle, dukungan dark
 * mode). Semua client component procurement sebaiknya dibungkus di sini
 * supaya tidak ada drift antar halaman.
 */
export function ProcurementPageShell({
  title,
  subtitle,
  backHref,
  actions,
  children,
}: ProcurementPageShellProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {backHref && (
              <Link
                href={backHref}
                className="mt-1 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                aria-label="Kembali"
              >
                <HiArrowLeft className="w-5 h-5" />
              </Link>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}

/**
 * Tombol header siap-pakai dengan styling Tailwind konsisten.
 * Dipakai oleh `actions` prop di `ProcurementPageShell`.
 */
export function HeaderActionButton({
  label,
  href,
  onClick,
  variant = "primary",
}: PageHeaderAction) {
  const className = buildActionClassName(variant);
  if (href) {
    return (
      <Link href={href} className={className}>
        {label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {label}
    </button>
  );
}

function buildActionClassName(
  variant: NonNullable<PageHeaderAction["variant"]>,
): string {
  const base =
    "inline-flex items-center gap-1 px-4 py-2 rounded-md text-sm font-medium transition";
  switch (variant) {
    case "primary":
      return `${base} bg-blue-600 text-white hover:bg-blue-700`;
    case "danger":
      return `${base} bg-red-600 text-white hover:bg-red-700`;
    case "secondary":
    default:
      return `${base} border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800`;
  }
}

/**
 * Card pembungkus tabel/list. Pakai shadow lembut + rounded-2xl agar
 * kelihatan modern dan konsisten dengan modul Inventory.
 */
export function ProcurementListCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {children}
    </div>
  );
}

/**
 * Standar input filter (search/select) — rounded penuh + shadow ringan.
 * Pakai `as` untuk memilih element type. Class diteruskan via prop apa adanya
 * supaya pemakaian tetap kompatibel dengan input/select native.
 */
export const PROCUREMENT_INPUT_CLASS =
  "h-11 px-4 rounded-xl border border-gray-100 bg-white text-sm font-medium text-gray-800 shadow-sm transition placeholder:text-gray-400 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-950/40";
