"use client";

import {
  getRequestedQuantity,
  isLineRejected,
  wasQtyChanged,
} from "./approvalUtils";
import type { PurchaseRequestItem, PurchaseRequestJasaItem } from "./types";

interface RestockLineApprovalInfoProps {
  line: PurchaseRequestItem | PurchaseRequestJasaItem;
  satuan: string;
  /** Satuan jumlah yang diajukan bila berbeda (barang asli sebelum diganti). */
  requestedSatuan?: string;
  /** Nama barang yang semula diajukan bila approver menggantinya. */
  substitutedFromName?: string | null;
}

/**
 * Ringkasan keputusan approver untuk satu baris: ditolak, jumlah diubah, atau
 * barang diganti, beserta catatannya. Tidak merender apa pun untuk baris yang
 * disetujui apa adanya tanpa catatan.
 */
export function RestockLineApprovalInfo({
  line,
  satuan,
  requestedSatuan = satuan,
  substitutedFromName,
}: RestockLineApprovalInfoProps) {
  const isRejected = isLineRejected(line);
  const isQtyChanged = !isRejected && wasQtyChanged(line);
  if (
    !isRejected &&
    !isQtyChanged &&
    !substitutedFromName &&
    !line.catatanApproval
  ) {
    return null;
  }

  return (
    <div className="mt-1 space-y-1">
      {isRejected && (
        <span className="inline-block rounded-lg bg-rose-100 px-2 py-0.5 text-[10px] font-black uppercase text-rose-600 dark:bg-rose-900/40 dark:text-rose-300">
          Ditolak
        </span>
      )}
      {!isRejected && substitutedFromName && (
        <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
          Diganti dari {substitutedFromName}
        </div>
      )}
      {isQtyChanged && (
        <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
          Diajukan {getRequestedQuantity(line)} {requestedSatuan}, disetujui{" "}
          {line.jumlah} {satuan}
        </div>
      )}
      {line.catatanApproval && (
        <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">
          Catatan atasan: {line.catatanApproval}
        </div>
      )}
    </div>
  );
}
