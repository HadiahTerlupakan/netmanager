"use client";

import { Modal } from "@/components/ui/Modal";
import {
  canCancelRestockRequest,
  canEnterRestockGoods,
  getRestockStatusKey,
  isRestockClosed,
  type RestockStatusKey,
} from "@/modules/inventory/client";

import { isLineRejected } from "./approvalUtils";
import { RestockDetailLines } from "./RestockDetailLines";
import { RestockLineApprovalInfo } from "./RestockLineApprovalInfo";
import { RestockProgressStatus } from "./RestockStatusBadge";
import { RestockTimeline } from "./RestockTimeline";
import { CANCEL_REQUEST_LABEL } from "./restockCancel";
import { ENTER_GOODS_LABEL } from "./restockReceiveForm";
import type { PurchaseRequest, PurchaseRequestJasaItem } from "./types";

interface RestockDetailModalProps {
  request: PurchaseRequest | null;
  onClose: () => void;
  /** Izin restock:verify: memasukkan barang dan membatalkan pengajuan. */
  canVerify?: boolean;
  /** Buka "Lapor Barang Sampai" untuk pengajuan ini. */
  onOpenReceive?: (request: PurchaseRequest) => void;
  /** Buka "Batalkan Pengajuan" untuk pengajuan ini. */
  onOpenCancel?: (request: PurchaseRequest) => void;
}

/** Belum disetujui: barisnya tampil sebagai jumlah yang diajukan saja. */
const UNDECIDED_STATUS_KEYS: ReadonlySet<RestockStatusKey> = new Set([
  "AWAITING_APPROVAL",
  "REJECTED",
]);
const INFO_BOX_CLASS =
  "bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-700";
const ACTION_BUTTON_CLASS =
  "min-h-[44px] w-full rounded-2xl bg-indigo-700 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-800";
const CANCEL_BUTTON_CLASS =
  "min-h-[44px] w-full rounded-2xl border border-red-300 bg-white px-4 py-3 text-sm font-bold text-red-800 hover:bg-red-50 dark:border-red-800 dark:bg-gray-800 dark:text-red-200 dark:hover:bg-red-950/30";

function InfoBox({ label, children }: { label: string; children: string }) {
  return (
    <div className={INFO_BOX_CLASS}>
      <div className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
        {label}
      </div>
      <div className="text-sm font-semibold text-gray-900 dark:text-white">
        {children}
      </div>
    </div>
  );
}

/** Keputusan atasan untuk seluruh pengajuan: siapa yang memutuskan dan catatannya. */
function ApprovalDecisionBox({ request }: { request: PurchaseRequest }) {
  if (!request.approver && !request.catatanApproval) return null;
  return (
    <div className={`${INFO_BOX_CLASS} space-y-1`}>
      <div className="text-xs font-bold text-gray-600 dark:text-gray-400">
        Keputusan Atasan
      </div>
      {request.approver && (
        <div className="text-sm font-bold text-gray-900 dark:text-white">
          {request.approver.name}
        </div>
      )}
      {request.catatanApproval && (
        <div className="text-sm text-gray-700 dark:text-gray-300">
          {request.catatanApproval}
        </div>
      )}
    </div>
  );
}

/**
 * Label konfirmasi jasa; baris yang ditolak ditandai lewat info persetujuannya.
 * Teks kecil, jadi warnanya ≥4.5:1 di mode terang maupun gelap.
 */
function JasaStatusChip({ item }: { item: PurchaseRequestJasaItem }) {
  if (isLineRejected(item)) return null;
  if (item.statusKonfirmasi === "SELESAI") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-100">
        Selesai
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-100">
      Menunggu Konfirmasi
    </span>
  );
}

function RestockDetailJasaList({
  jasaItems,
}: {
  jasaItems: PurchaseRequestJasaItem[];
}) {
  return (
    <div className="space-y-3">
      <div className="text-xs font-bold text-violet-700 dark:text-violet-300 uppercase px-1">
        Daftar Jasa
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-violet-100 dark:border-violet-900/40 overflow-hidden">
        {jasaItems.map((item, index) => {
          const isSelesai = item.statusKonfirmasi === "SELESAI";
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
                  <JasaStatusChip item={item} />
                </div>
                <div className="font-bold text-sm text-gray-900 dark:text-white">
                  {item.jasa.nama}
                </div>
                <div className="text-xs text-gray-500">{item.jasa.kode}</div>
                <RestockLineApprovalInfo
                  line={item}
                  satuan={item.jasa.satuan}
                />
                {item.keterangan && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">
                    {item.keterangan}
                  </div>
                )}
                {isSelesai && item.tanggalSelesai && (
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold mt-1">
                    Selesai:{" "}
                    {new Date(item.tanggalSelesai).toLocaleDateString("id-ID")}
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
                <div className="font-black text-violet-600 dark:text-violet-300">
                  {item.jumlah} {item.jasa.satuan}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Detail pengajuan: status, keputusan atasan, riwayat, barang, jasa, dan
 * tombol lanjutan.
 */
export function RestockDetailModal({
  request,
  onClose,
  canVerify = false,
  onOpenReceive,
  onOpenCancel,
}: RestockDetailModalProps) {
  const barangItems = request?.items ?? [];
  const jasaItems = request?.jasaItems ?? [];
  const isShowingProgress =
    !!request && !UNDECIDED_STATUS_KEYS.has(getRestockStatusKey(request));
  const isShowingEnter =
    canVerify && !!request && !!onOpenReceive && canEnterRestockGoods(request);
  const isShowingCancel =
    canVerify &&
    !!request &&
    !!onOpenCancel &&
    canCancelRestockRequest(request);

  return (
    <Modal
      isOpen={!!request}
      onClose={onClose}
      title="Detail Pengajuan"
      size="2xl"
    >
      <div className="p-4 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <InfoBox label="Nomor">{request?.nomorRequest ?? "-"}</InfoBox>
          <div className={INFO_BOX_CLASS}>
            <div className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1">
              Status
            </div>
            {request && <RestockProgressStatus request={request} />}
          </div>
          <InfoBox label="Gudang tujuan">
            {request?.gudang?.nama || "-"}
          </InfoBox>
          <InfoBox label="Catatan">{request?.keterangan || "-"}</InfoBox>
        </div>

        {request && <ApprovalDecisionBox request={request} />}

        {request && <RestockTimeline request={request} />}

        {request && barangItems.length > 0 && (
          <RestockDetailLines
            items={barangItems}
            isShowingProgress={isShowingProgress}
            isOrderFinished={isRestockClosed(request)}
          />
        )}

        {jasaItems.length > 0 && (
          <RestockDetailJasaList jasaItems={jasaItems} />
        )}

        {request && isShowingEnter && (
          <button
            type="button"
            onClick={() => onOpenReceive?.(request)}
            aria-label={`${ENTER_GOODS_LABEL} untuk ${request.nomorRequest}`}
            className={ACTION_BUTTON_CLASS}
          >
            {ENTER_GOODS_LABEL}
          </button>
        )}

        {request && isShowingCancel && (
          <button
            type="button"
            onClick={() => onOpenCancel?.(request)}
            aria-label={`${CANCEL_REQUEST_LABEL} ${request.nomorRequest}`}
            className={CANCEL_BUTTON_CLASS}
          >
            {CANCEL_REQUEST_LABEL}
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
