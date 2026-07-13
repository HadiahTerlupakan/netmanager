"use client";

import type { RefObject } from "react";
import { FiCheck, FiImage, FiTool } from "react-icons/fi";

import { Modal } from "@/components/ui/Modal";
import {
  PhotoUpload,
  type PhotoUploadRef,
  type UploadedPhoto,
} from "@/components/inventory/PhotoUpload";

import type { PurchaseRequest, PurchaseRequestJasaItem } from "./types";

interface JasaConfirmState {
  tanggalSelesai: string;
  buktiSelesai: UploadedPhoto[];
  confirmed: boolean;
}

interface RestockConfirmJasaModalProps {
  request: PurchaseRequest | null;
  jasaConfirmStates: Record<string, JasaConfirmState>;
  onJasaConfirmStateChange: (
    jasaItemId: string,
    next: Partial<JasaConfirmState>,
  ) => void;
  photoUploadRefs: Record<string, RefObject<PhotoUploadRef | null>>;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

function pendingJasaItems(request: PurchaseRequest): PurchaseRequestJasaItem[] {
  return (request.jasaItems ?? []).filter(
    (item) => item.statusKonfirmasi === "PENDING",
  );
}

function isJasaItemReady(state: JasaConfirmState | undefined): boolean {
  if (!state) return false;
  return state.confirmed && state.buktiSelesai.length > 0;
}

export function RestockConfirmJasaModal({
  request,
  jasaConfirmStates,
  onJasaConfirmStateChange,
  photoUploadRefs,
  submitting,
  onClose,
  onSubmit,
}: RestockConfirmJasaModalProps) {
  const pending = request ? pendingJasaItems(request) : [];
  const readyCount = pending.filter((item) =>
    isJasaItemReady(jasaConfirmStates[item.id]),
  ).length;
  const isSubmitDisabled = submitting || readyCount === 0;

  return (
    <Modal
      isOpen={!!request && pending.length > 0}
      onClose={() => !submitting && onClose()}
      title="Konfirmasi Jasa Selesai"
      size="2xl"
    >
      <div className="p-6 space-y-6">
        <div className="bg-violet-50 dark:bg-violet-900/30 p-4 rounded-2xl flex justify-between items-center border border-violet-100 dark:border-violet-800">
          <div>
            <div className="text-xs font-bold text-violet-400 uppercase mb-1">
              Konfirmasi Penyelesaian Jasa
            </div>
            <div className="font-bold text-violet-900 dark:text-violet-200 text-lg">
              {request?.nomorRequest}
            </div>
          </div>
          <FiTool className="text-violet-600 w-10 h-10" />
        </div>

        <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
          {pending.map((item) => {
            const state = jasaConfirmStates[item.id];
            const ref = photoUploadRefs[item.id];
            const ready = isJasaItemReady(state);

            return (
              <div
                key={item.id}
                className={`p-5 rounded-[2rem] border transition-all ${
                  ready
                    ? "bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800"
                    : "bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700"
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="font-black text-sm text-gray-900 dark:text-white">
                      {item.jasa.nama}
                    </div>
                    <div className="text-xs text-gray-400 font-bold uppercase">
                      {item.jasa.kode} · {item.jumlah} {item.jasa.satuan}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={state?.confirmed ?? false}
                      onChange={(event) =>
                        onJasaConfirmStateChange(item.id, {
                          confirmed: event.target.checked,
                        })
                      }
                      className="w-5 h-5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                    />
                    <span className="text-[11px] font-black text-gray-500 uppercase">
                      Selesai
                    </span>
                  </label>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-col space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                      Tanggal Selesai
                    </label>
                    <input
                      type="date"
                      value={state?.tanggalSelesai ?? ""}
                      onChange={(event) =>
                        onJasaConfirmStateChange(item.id, {
                          tanggalSelesai: event.target.value,
                        })
                      }
                      className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl h-12 px-4 text-sm font-medium focus:ring-2 focus:ring-violet-500 transition-all"
                    />
                  </div>

                  <div className="flex flex-col space-y-1.5">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                      <FiImage /> Bukti Penyelesaian (Wajib)
                    </label>
                    <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                      {ref && (
                        <PhotoUpload
                          ref={ref}
                          onPhotosChange={(photos) =>
                            onJasaConfirmStateChange(item.id, {
                              buktiSelesai: photos,
                            })
                          }
                          maxPhotos={3}
                          transactionType="inventory-masuk"
                        />
                      )}
                    </div>
                    {(state?.buktiSelesai?.length ?? 0) === 0 && (
                      <p className="text-[10px] font-bold text-red-500 ml-1">
                        Upload minimal 1 foto/bukti
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={onSubmit}
            disabled={isSubmitDisabled}
            className="flex-[2] px-4 py-4 bg-violet-600 text-white rounded-2xl font-bold disabled:opacity-50 shadow-lg hover:bg-violet-700 transition-all flex items-center justify-center gap-2"
          >
            {submitting ? (
              "Menyimpan..."
            ) : (
              <>
                <FiCheck /> Konfirmasi {readyCount} Jasa Selesai
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export type { JasaConfirmState };
