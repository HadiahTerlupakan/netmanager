"use client";

import { getRestockLineProgress } from "@/modules/inventory/client";

import {
  getRequestedQuantity,
  getRequestedSatuan,
  isLineRejected,
  wasSubstituted,
} from "./approvalUtils";
import { RestockLineApprovalInfo } from "./RestockLineApprovalInfo";
import { getRestockLineCancelReason } from "./restockStatus";
import type { PurchaseRequestItem } from "./types";

interface RestockDetailLinesProps {
  items: PurchaseRequestItem[];
  /** true sesudah disetujui: tampilkan kolom disetujui, masuk gudang, dan sisanya. */
  isShowingProgress: boolean;
  /** Pengajuan sudah ditutup: sisa yang belum masuk dihitung tidak masuk. */
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

/** Judul kolom terakhir: sisa yang belum masuk, atau yang tidak masuk setelah ditutup. */
function getLastColumnLabel(isOrderFinished: boolean): string {
  return isOrderFinished ? "Tidak masuk" : "Sisa";
}

/** "12 roll (+2 lebih)" bila yang masuk melebihi jumlah yang disetujui. */
function formatReceived(item: PurchaseRequestItem, received: number): string {
  const satuan = item.barang.satuan;
  const extra = received - item.jumlah;
  return extra > 0
    ? `${received} ${satuan} (+${extra} lebih)`
    : `${received} ${satuan}`;
}

function ProgressLine({
  item,
  isOrderFinished,
}: {
  item: PurchaseRequestItem;
  isOrderFinished: boolean;
}) {
  const satuan = item.barang.satuan;
  const isRejected = isLineRejected(item);
  const { received, cancelled, remaining } = getRestockLineProgress(
    item,
    isOrderFinished,
  );
  const cancelReason = isRejected ? null : getRestockLineCancelReason(item);
  const lastValue = isOrderFinished ? cancelled : remaining;
  const showUnlessRejected = (text: string) => (isRejected ? "-" : text);

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
        {cancelReason && cancelled > 0 && (
          <p className="mt-1 text-xs font-semibold text-orange-800 dark:text-orange-300">
            Alasan tidak masuk: {cancelReason}
          </p>
        )}
      </div>
      <NumberCell
        label="Diajukan"
        value={`${getRequestedQuantity(item)} ${getRequestedSatuan(item)}`}
      />
      <NumberCell
        label="Disetujui"
        value={showUnlessRejected(`${item.jumlah} ${satuan}`)}
      />
      <NumberCell
        label="Masuk gudang"
        value={showUnlessRejected(formatReceived(item, received))}
      />
      <NumberCell
        label={getLastColumnLabel(isOrderFinished)}
        value={showUnlessRejected(`${lastValue} ${satuan}`)}
      />
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

/**
 * Daftar barang di detail; sesudah disetujui tampil dengan jumlah yang
 * diajukan, disetujui, masuk gudang, dan sisanya per barang.
 */
export function RestockDetailLines({
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
            <span className="text-right">Diajukan</span>
            <span className="text-right">Disetujui</span>
            <span className="text-right">Masuk gudang</span>
            <span className="text-right">
              {getLastColumnLabel(isOrderFinished)}
            </span>
          </div>
        )}
        {items.map((item) =>
          isShowingProgress ? (
            <ProgressLine
              key={item.id}
              item={item}
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
