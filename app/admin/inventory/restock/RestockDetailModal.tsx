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
        <div className="space-y-3">
          <div className="text-xs font-bold text-gray-400 uppercase px-1">
            Daftar Barang
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            {request?.items.map((item, index) => {
              const isNotSent =
                request.status === "RECEIVED" &&
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
                      {request.status === "RECEIVED"
                        ? item.receivedQuantity
                        : item.jumlah}
                      {request.status === "RECEIVED" &&
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
