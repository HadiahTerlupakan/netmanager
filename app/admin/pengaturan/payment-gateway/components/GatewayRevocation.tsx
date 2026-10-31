"use client";

import { HiOutlineArrowPath, HiOutlineNoSymbol } from "react-icons/hi2";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";

/** Permintaan mengubah sakelar darurat satu provider, menunggu konfirmasi. */
export type PendingRevocation = {
  providerId: string;
  providerName: string;
  isRevoked: boolean;
};

const REVOKE_DESCRIPTION =
  "Sakelar darurat untuk kredensial yang bocor. Selama dicabut, callback dan cek status untuk konfigurasi ini ditolak, checkout baru tidak bisa dibuat, dan metodenya hilang dari pilihan pelanggan. Pembayaran lewat VA/QR yang sudah terbit tidak tercatat otomatis sampai konfigurasi dipulihkan.";
const RESTORE_DESCRIPTION =
  "Checkout baru, callback, dan cek status untuk konfigurasi ini kembali diterima. Pastikan kredensial yang bocor sudah diganti. Pembayaran yang masuk selama dicabut tercatat saat gateway mengirim ulang callback atau ditanya lagi.";

/** Tombol "Cabut konfigurasi (kill switch)" atau "Pulihkan" di kartu provider. */
export function GatewayRevocationButton({
  isRevoked,
  onClick,
}: {
  readonly isRevoked: boolean;
  readonly onClick: () => void;
}) {
  const Icon = isRevoked ? HiOutlineArrowPath : HiOutlineNoSymbol;
  const tone = isRevoked
    ? "border-green-600 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
    : "border-red-600 text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-4 py-2 border rounded-lg transition-colors flex items-center justify-center gap-2 ${tone}`}
    >
      <Icon className="w-5 h-5" aria-hidden="true" />
      {isRevoked ? "Pulihkan" : "Cabut konfigurasi (kill switch)"}
    </button>
  );
}

/** Konfirmasi yang menjelaskan akibat mencabut atau memulihkan konfigurasi. */
export function GatewayRevocationDialog({
  pending,
  onConfirm,
  onCancel,
}: {
  readonly pending: PendingRevocation | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}) {
  const isRevoking = pending?.isRevoked ?? false;

  return (
    <ConfirmDialog
      open={pending !== null}
      title={
        isRevoking
          ? `Cabut konfigurasi ${pending?.providerName}?`
          : `Pulihkan konfigurasi ${pending?.providerName}?`
      }
      description={isRevoking ? REVOKE_DESCRIPTION : RESTORE_DESCRIPTION}
      confirmText={isRevoking ? "Cabut konfigurasi" : "Pulihkan konfigurasi"}
      cancelText="Batal"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
