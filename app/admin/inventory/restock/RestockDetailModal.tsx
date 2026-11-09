"use client";

import { Modal } from "@/components/ui/Modal";

import { isLineRejected } from "./approvalUtils";
import { RestockDetailLines } from "./RestockDetailLines";
import { RestockLineApprovalInfo } from "./RestockLineApprovalInfo";
import { RestockPurchaseLinkPanel } from "./RestockPurchaseLinkPanel";
import { RestockPurchaseVoidControl } from "./RestockPurchaseVoidControl";
import { RestockStatusBadge } from "./RestockStatusBadge";
import { RestockTimeline } from "./RestockTimeline";
import {
  getRestockProgress,
  getRestockProgressActions,
  isRestockOrderFinished,
} from "./restockProgress";
import { canRecordRestockPurchase } from "./restockPurchase";
import type { PurchaseRequest } from "./types";

interface RestockDetailModalProps {
  request: PurchaseRequest | null;
  onClose: () => void;
  canVerify?: boolean;
  onOpenReceive?: (request: PurchaseRequest) => void;
  onRecordPurchase?: (request: PurchaseRequest) => void;
  /** Muat ulang data setelah catatan belanja dibatalkan. */
  onPurchaseVoided?: () => Promise<void>;
}

const UNDECIDED_STATUSES = new Set(["DRAFT", "SUBMITTED", "REJECTED"]);
/**
 * Status pengajuan yang panel link belanjanya dimuat. Pengajuan yang sudah
 * ditutup ikut dimuat supaya link yang masih tersisa tetap bisa dimatikan;
 * panel menyembunyikan dirinya bila tidak ada link aktif.
 */
const PURCHASE_LINK_STATUSES = new Set([
  "APPROVED",
  "ORDERED",
  "RECEIVED",
  "CANCELLED",
]);
/** Pesanan yang sudah ditutup: catatan belanjanya tidak bisa dibatalkan. */
const CLOSED_ORDER_STATUSES = new Set(["RECEIVED", "CANCELLED"]);
const ACTION_BUTTON_CLASS =
  "min-h-[44px] w-full rounded-2xl bg-indigo-700 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-800";
/** Tombol kedua: dipakai terima barang selama "Catat Belanja" masih utama. */
const SECONDARY_ACTION_BUTTON_CLASS =
  "min-h-[44px] w-full rounded-2xl border border-indigo-300 bg-white px-4 py-3 text-sm font-bold text-indigo-800 hover:bg-indigo-50 dark:border-indigo-700 dark:bg-gray-800 dark:text-indigo-200";

/** Detail pengajuan: riwayat perjalanan pesanan, barang, jasa, dan tombol lanjutan. */
export function RestockDetailModal({
  request,
  onClose,
  canVerify = false,
  onOpenReceive,
  onRecordPurchase,
  onPurchaseVoided,
}: RestockDetailModalProps) {
  const barangItems = request?.items ?? [];
  const jasaItems = request?.jasaItems ?? [];
  const actions = request
    ? getRestockProgressActions(getRestockProgress(request).key)
    : null;
  const canRecordPurchase =
    canVerify &&
    !!onRecordPurchase &&
    !!request &&
    canRecordRestockPurchase(request);
  const receiveLabel =
    canVerify && onOpenReceive ? actions?.receiveLabel : null;
  const canManagePurchaseLink =
    canVerify && !!request && PURCHASE_LINK_STATUSES.has(request.status);
  const canVoidPurchase =
    canVerify &&
    !!onPurchaseVoided &&
    !!request &&
    !CLOSED_ORDER_STATUSES.has(request.purchaseOrder?.status ?? "");
  const isShowingProgress =
    !!request && !UNDECIDED_STATUSES.has(request.status);

  return (
    <Modal
      isOpen={!!request}
      onClose={onClose}
      title="Detail Pengajuan"
      size="2xl"
    >
      <div className="p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
            <div className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
              Nomor
            </div>
            <div className="font-bold text-indigo-700 dark:text-indigo-300">
              {request?.nomorRequest}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
            <div className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
              Status
            </div>
            <div>{request && <RestockStatusBadge request={request} />}</div>
          </div>
        </div>

        {request && (
          <RestockTimeline
            request={request}
            recordPurchaseAction={
              canRecordPurchase ? (
                <button
                  type="button"
                  onClick={() => onRecordPurchase?.(request)}
                  aria-label={`Catat Belanja, pengajuan ${request.nomorRequest}`}
                  className="min-h-[44px] rounded-xl bg-indigo-700 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-800"
                >
                  Catat Belanja
                </button>
              ) : null
            }
            renderPurchaseVoidAction={
              canVoidPurchase
                ? (record, label) => (
                    <RestockPurchaseVoidControl
                      requestId={request.id}
                      recordId={record.id}
                      recordLabel={label}
                      onVoided={onPurchaseVoided}
                    />
                  )
                : undefined
            }
          />
        )}

        {request && canManagePurchaseLink && (
          <RestockPurchaseLinkPanel key={request.id} request={request} />
        )}

        {(request?.approver || request?.catatanApproval) && (
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-1">
            <div className="text-xs font-bold text-gray-600 dark:text-gray-400">
              Keputusan Atasan
            </div>
            {request?.approver && (
              <div className="text-sm font-bold text-gray-900 dark:text-white">
                {request?.approver.name}
              </div>
            )}
            {request?.catatanApproval && (
              <div className="text-sm text-gray-700 dark:text-gray-300">
                {request?.catatanApproval}
              </div>
            )}
          </div>
        )}

        {request && barangItems.length > 0 && (
          <RestockDetailLines
            request={request}
            items={barangItems}
            isShowingProgress={isShowingProgress}
            isOrderFinished={isRestockOrderFinished(request)}
          />
        )}

        {jasaItems.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs font-bold text-violet-400 uppercase px-1">
              Daftar Jasa
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-violet-100 dark:border-violet-900/40 overflow-hidden">
              {jasaItems.map((item, index) => {
                const isSelesai = item.statusKonfirmasi === "SELESAI";
                const isRejected = isLineRejected(item);
                return (
                  <div
                    key={item.id}
                    className={`flex justify-between p-4 gap-4 ${index !== 0 ? "border-t border-violet-50 dark:border-violet-900/30" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                          Jasa
                        </span>
                        {isRejected ? null : isSelesai ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700">
                            Selesai
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-yellow-700">
                            Menunggu Konfirmasi
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-sm text-gray-900 dark:text-white">
                        {item.jasa.nama}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.jasa.kode}
                      </div>
                      <RestockLineApprovalInfo
                        line={item}
                        satuan={item.jasa.satuan}
                      />
                      {item.keterangan && (
                        <div className="text-xs text-gray-400 mt-1 italic">
                          {item.keterangan}
                        </div>
                      )}
                      {isSelesai && item.tanggalSelesai && (
                        <div className="text-[10px] text-emerald-600 font-bold mt-1">
                          Selesai:{" "}
                          {new Date(item.tanggalSelesai).toLocaleDateString(
                            "id-ID",
                          )}
                        </div>
                      )}
                      {isSelesai &&
                        item.buktiSelesai &&
                        item.buktiSelesai.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {item.buktiSelesai.map((url) => (
                              <a
                                key={url}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="block w-12 h-12 rounded-xl overflow-hidden border border-violet-100 dark:border-violet-800"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={url}
                                  alt="Bukti"
                                  className="w-full h-full object-cover"
                                />
                              </a>
                            ))}
                          </div>
                        )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-black text-violet-600">
                        {item.jumlah} {item.jasa.satuan}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {request && receiveLabel && (
          <button
            type="button"
            onClick={() => onOpenReceive?.(request)}
            aria-label={`${receiveLabel} untuk ${request.nomorRequest}`}
            className={
              canRecordPurchase
                ? SECONDARY_ACTION_BUTTON_CLASS
                : ACTION_BUTTON_CLASS
            }
          >
            {receiveLabel}
          </button>
        )}

        <button
          onClick={onClose}
          className="min-h-[44px] w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-lg"
        >
          Tutup
        </button>
      </div>
    </Modal>
  );
}
