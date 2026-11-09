"use client";

import {
  getRequestedSatuan,
  isLineRejected,
  wasSubstituted,
} from "./approvalUtils";
import { RestockLineApprovalInfo } from "./RestockLineApprovalInfo";
import { getRestockLineProgress } from "./restockProgress";
import {
  describeLinePurchaseBreakdown,
  getRestockLinePurchase,
  isRestockLegacyPurchased,
} from "./restockPurchase";
import type { PurchaseRequest, PurchaseRequestItem } from "./types";

interface RestockDetailLinesProps {
  /** Pengajuan pemilik baris; dipakai untuk rincian belanja per toko. */
  request: PurchaseRequest;
  items: PurchaseRequestItem[];
  /** true sesudah disetujui: tampilkan kolom dipesan/dibeli/datang/ditunggu. */
  isShowingProgress: boolean;
  /** Pesanan sudah selesai: sisa yang belum datang tidak ditunggu lagi. */
  isOrderFinished?: boolean;
}

const GRID_CLASS =
  "sm:grid sm:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] sm:gap-3";

function LineApprovalInfo({ item }: { item: PurchaseRequestItem }) {
  return (
    <RestockLineApprovalInfo
      line={item}
      satuan={item.barang.satuan}
      requestedSatuan={getRequestedSatuan(item)}
      substitutedFromName={
        wasSubstituted(item)
          ? (item.barangDiminta?.nama ?? "barang lain")
          : null
      }
    />
  );
}

function NumberCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm sm:block sm:text-right">
      <span className="text-gray-600 dark:text-gray-400 sm:sr-only">
        {label}
      </span>
      <span className="font-bold text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}

/**
 * "Dibeli 5 dari 10 roll (Toko A 3, Toko B 2)"; null bila belum dibeli.
 * Barang yang sudah dibeli lalu dicoret karena tidak dikirim toko ditulis
 * terpisah supaya angkanya cocok dengan rincian toko.
 */
function describeLinePurchase(
  item: PurchaseRequestItem,
  request: PurchaseRequest,
): string | null {
  const { limit, purchased, purchasedTotal, boughtButNotDelivered } =
    getRestockLinePurchase(item, isRestockLegacyPurchased(request));
  if (purchasedTotal === 0) return null;
  const satuan = item.barang.satuan;
  const breakdown = describeLinePurchaseBreakdown(item, request);
  const detail = breakdown ? ` (${breakdown})` : "";
  if (boughtButNotDelivered > 0) {
    return `Dibeli ${purchasedTotal} ${satuan}${detail}, ${boughtButNotDelivered} ${satuan} di antaranya tidak dikirim toko`;
  }
  return `Dibeli ${purchased} dari ${limit} ${satuan}${detail}`;
}

function ProgressLine({
  item,
  request,
  isOrderFinished,
}: {
  item: PurchaseRequestItem;
  request: PurchaseRequest;
  isOrderFinished: boolean;
}) {
  const satuan = item.barang.satuan;
  const isRejected = isLineRejected(item);
  const { ordered, received, cancelled, remaining } = getRestockLineProgress(
    item,
    isOrderFinished,
  );
  const { purchasedTotal } = getRestockLinePurchase(
    item,
    isRestockLegacyPurchased(request),
  );
  const purchaseText = isRejected ? null : describeLinePurchase(item, request);
  const formatQty = (value: number) =>
    isRejected ? "-" : `${value} ${satuan}`;

  return (
    <div className={`space-y-2 p-4 ${GRID_CLASS}`}>
      <div className="min-w-0">
        <p
          className={`text-sm font-bold ${isRejected ? "text-gray-600 line-through dark:text-gray-400" : "text-gray-900 dark:text-white"}`}
        >
          {item.barang.nama}
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {item.barang.kode}
        </p>
        <LineApprovalInfo item={item} />
        {purchaseText && (
          <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
            {purchaseText}
          </p>
        )}
        {cancelled > 0 && (
          <p className="mt-1 text-xs font-semibold text-orange-800 dark:text-orange-300">
            Tidak jadi datang {cancelled} {satuan}.
            {item.cancelReason ? ` Alasan: ${item.cancelReason}` : ""}
          </p>
        )}
      </div>
      <NumberCell label="Dipesan" value={formatQty(ordered)} />
      <NumberCell label="Sudah dibeli" value={formatQty(purchasedTotal)} />
      <NumberCell label="Sudah datang" value={formatQty(received)} />
      <NumberCell label="Masih ditunggu" value={formatQty(remaining)} />
    </div>
  );
}

function RequestedLine({ item }: { item: PurchaseRequestItem }) {
  const isRejected = isLineRejected(item);
  return (
    <div className="flex justify-between gap-3 p-4">
      <div className="min-w-0">
        <p
          className={`text-sm font-bold ${isRejected ? "text-gray-600 line-through dark:text-gray-400" : "text-gray-900 dark:text-white"}`}
        >
          {item.barang.nama}
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {item.barang.kode}
        </p>
        <LineApprovalInfo item={item} />
      </div>
      <p className="shrink-0 text-sm font-bold text-gray-900 dark:text-white">
        {item.jumlah} {item.barang.satuan}
      </p>
    </div>
  );
}

/** Daftar barang di detail; sesudah disetujui tampil sebagai progres per barang. */
export function RestockDetailLines({
  request,
  items,
  isShowingProgress,
  isOrderFinished = false,
}: RestockDetailLinesProps) {
  return (
    <section className="space-y-2">
      <h3 className="px-1 text-sm font-bold text-gray-800 dark:text-gray-200">
        Daftar Barang
      </h3>
      <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
        {isShowingProgress && (
          <div
            aria-hidden="true"
            className={`hidden bg-gray-50 px-4 py-2 text-xs font-bold text-gray-700 dark:bg-gray-900 dark:text-gray-300 ${GRID_CLASS}`}
          >
            <span>Barang</span>
            <span className="text-right">Dipesan</span>
            <span className="text-right">Sudah dibeli</span>
            <span className="text-right">Sudah datang</span>
            <span className="text-right">Masih ditunggu</span>
          </div>
        )}
        {items.map((item) =>
          isShowingProgress ? (
            <ProgressLine
              key={item.id}
              item={item}
              request={request}
              isOrderFinished={isOrderFinished}
            />
          ) : (
            <RequestedLine key={item.id} item={item} />
          ),
        )}
      </div>
    </section>
  );
}
