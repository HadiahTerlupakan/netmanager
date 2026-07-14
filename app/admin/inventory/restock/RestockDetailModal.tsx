"use client";

import { Modal } from "@/components/ui/Modal";

import { RestockStatusBadge } from "./RestockStatusBadge";
import type { PurchaseRequest } from "./types";

interface RestockDetailModalProps {
  request: PurchaseRequest | null;
  onClose: () => void;
}

export function RestockDetailModal({
  request,
  onClose,
}: RestockDetailModalProps) {
  const barangItems = request?.items ?? [];
  const jasaItems = request?.jasaItems ?? [];

  return (
    <Modal
      isOpen={!!request}
      onClose={onClose}
      title="Detail Pengajuan Restock"
      size="2xl"
    >
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
            <div className="text-xs font-bold text-gray-400 uppercase mb-1">
              Nomor
            </div>
            <div className="font-bold text-indigo-600">
              {request?.nomorRequest}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
            <div className="text-xs font-bold text-gray-400 uppercase mb-1">
              Status
            </div>
            <div>
              {request && <RestockStatusBadge status={request.status} />}
            </div>
          </div>
        </div>

        {barangItems.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs font-bold text-gray-400 uppercase px-1">
              Daftar Barang
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              {barangItems.map((item, index) => {
                const isNotSent =
                  request?.status === "RECEIVED" &&
                  (item.receivedQuantity || 0) === 0;

                return (
                  <div
                    key={item.id}
                    className={`flex justify-between p-4 ${index !== 0 ? "border-t border-gray-50 dark:border-gray-700" : ""} ${isNotSent ? "bg-red-50/30 dark:bg-red-900/10" : ""}`}
                  >
                    <div className="flex-1">
                      <div
                        className={`font-bold text-sm ${isNotSent ? "text-gray-400 line-through" : "text-gray-900 dark:text-white"}`}
                      >
                        {item.barang.nama}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.barang.kode}
                      </div>
                      {isNotSent && (
                        <span className="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-black uppercase rounded-lg">
                          Tidak Dikirim
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-black ${isNotSent ? "text-gray-300" : "text-indigo-600"}`}
                      >
                        {request?.status === "RECEIVED"
                          ? item.receivedQuantity
                          : item.jumlah}
                        {request?.status === "RECEIVED" &&
                          item.receivedQuantity !== item.jumlah &&
                          !isNotSent && (
                            <span className="text-[10px] text-gray-400 font-bold ml-1">
                              / {item.jumlah}
                            </span>
                          )}
                      </div>
                      <div className="text-[10px] text-gray-400 uppercase font-bold">
                        {item.barang.satuan}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {jasaItems.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs font-bold text-violet-400 uppercase px-1">
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
                        {isSelesai ? (
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

        <button
          onClick={onClose}
          className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all shadow-lg"
        >
          Tutup
        </button>
      </div>
    </Modal>
  );
}
