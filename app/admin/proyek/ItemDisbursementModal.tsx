"use client";

import { useMemo, useState } from "react";
import { HiOutlineCheck, HiOutlineTrash } from "react-icons/hi2";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";

export interface LocalDisbursement {
  id: string;
  name: string;
  percentage: number;
  amount: number;
  estimatedDate: string;
  isPaid: boolean;
}

export interface LocalItem {
  id: string;
  name: string;
  category: string;
  expenseCategoryId?: string;
  quantity: number;
  unitPrice: number;
  expenseType: "CAPEX" | "OPEX";
  wbsGroupId?: string;
  disbursements: LocalDisbursement[];
}

interface ItemDisbursementModalProps {
  isOpen: boolean;
  item?: LocalItem;
  onClose: () => void;
  onUpdate: (disbursements: LocalDisbursement[]) => void;
}

/** Menampilkan editor termin pencairan untuk item RAB. */
export default function ItemDisbursementModal({
  isOpen,
  item,
  onClose,
  onUpdate,
}: ItemDisbursementModalProps) {
  const [draftByItemId, setDraftByItemId] = useState<
    Record<string, LocalDisbursement[]>
  >({});

  const activeItemId = item?.id ?? "";
  const disbursements = useMemo(() => {
    const sourceDisbursements = item?.disbursements ?? [];
    return draftByItemId[activeItemId] ?? sourceDisbursements;
  }, [activeItemId, draftByItemId, item]);
  const totalAmount = item ? item.quantity * item.unitPrice : 0;
  const calculatedDisbursements = useMemo(
    () =>
      disbursements.map((disbursement) => ({
        ...disbursement,
        amount: Math.round((disbursement.percentage / 100) * totalAmount),
      })),
    [disbursements, totalAmount],
  );

  if (!isOpen || !item) return null;

  const totalPercentage = calculatedDisbursements.reduce(
    (sum, disbursement) => sum + (Number(disbursement.percentage) || 0),
    0,
  );
  const isValid = totalPercentage === 100;

  /** Menyimpan daftar termin draft untuk item aktif. */
  function setDisbursements(
    updater:
      | LocalDisbursement[]
      | ((previous: LocalDisbursement[]) => LocalDisbursement[]),
  ) {
    const nextValue =
      typeof updater === "function" ? updater(disbursements) : updater;

    setDraftByItemId((previous) => ({
      ...previous,
      [item.id]: nextValue,
    }));
  }

  /** Menutup modal dan membuang draft termin item aktif. */
  function handleCloseModal() {
    setDraftByItemId((previous) => {
      const nextDraft = { ...previous };
      delete nextDraft[item.id];
      return nextDraft;
    });
    onClose();
  }

  /** Menambahkan baris termin baru. */
  function handleAddDisbursement() {
    setDisbursements((previous) => [
      ...previous,
      {
        id: crypto.randomUUID(),
        name: `Termin ${previous.length + 1}`,
        percentage: 0,
        amount: 0,
        estimatedDate: "",
        isPaid: false,
      },
    ]);
  }

  /** Memperbarui field termin tertentu. */
  function handleUpdateDisbursement(
    disbursementId: string,
    field: keyof LocalDisbursement,
    value: string | number | boolean,
  ) {
    setDisbursements((previous) =>
      previous.map((disbursement) =>
        disbursement.id === disbursementId
          ? { ...disbursement, [field]: value }
          : disbursement,
      ),
    );
  }

  /** Menghapus termin dari daftar editor. */
  function handleRemoveDisbursement(disbursementId: string) {
    setDisbursements((previous) =>
      previous.filter((disbursement) => disbursement.id !== disbursementId),
    );
  }

  /** Menyimpan hasil termin jika total persentase valid. */
  function handleSaveDisbursements() {
    if (!isValid && disbursements.length > 0) {
      toast.error("Total persentase termin harus persis 100%");
      return;
    }

    onUpdate(calculatedDisbursements);
    handleCloseModal();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-900/50">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Jadwal Termin: {item.name}
            </h3>
            <p className="text-sm text-gray-500">
              Total Harga:{" "}
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {formatCurrency(totalAmount)}
              </span>
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {disbursements.length === 0 ? (
            <div className="py-8 text-center">
              <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                Belum ada termin pencairan untuk item ini.
              </p>
              <button
                type="button"
                onClick={handleAddDisbursement}
                className="rounded-lg bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-600 transition-colors hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400"
              >
                + Tambah Termin
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mb-2 flex items-end justify-between">
                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  Daftar Termin
                </h4>
                <button
                  type="button"
                  onClick={handleAddDisbursement}
                  className="rounded bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-600 transition-colors hover:text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  + Tambah Baris
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500">
                        Keterangan
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500">
                        Est. Tanggal
                      </th>
                      <th className="w-24 px-4 py-3 text-right text-xs font-bold uppercase text-gray-500">
                        Persentase
                      </th>
                      <th className="w-40 px-4 py-3 text-right text-xs font-bold uppercase text-gray-500">
                        Nominal
                      </th>
                      <th className="w-16 px-4 py-3 text-center text-xs font-bold uppercase text-gray-500">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {calculatedDisbursements.map((disbursement, index) => (
                      <tr
                        key={disbursement.id}
                        className="group bg-white dark:bg-gray-900"
                      >
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={disbursement.name}
                            onChange={(event) =>
                              handleUpdateDisbursement(
                                disbursement.id,
                                "name",
                                event.target.value,
                              )
                            }
                            className="w-full rounded border border-transparent p-1.5 text-sm font-medium focus:border-indigo-300 dark:text-white"
                            placeholder={`Termin ${index + 1}`}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="date"
                            value={
                              disbursement.estimatedDate
                                ? new Date(disbursement.estimatedDate)
                                    .toISOString()
                                    .split("T")[0]
                                : ""
                            }
                            onChange={(event) =>
                              handleUpdateDisbursement(
                                disbursement.id,
                                "estimatedDate",
                                event.target.value,
                              )
                            }
                            className="w-full rounded border border-transparent p-1.5 text-sm focus:border-indigo-300 dark:text-white"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center justify-end">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={disbursement.percentage}
                              onChange={(event) =>
                                handleUpdateDisbursement(
                                  disbursement.id,
                                  "percentage",
                                  Number(event.target.value),
                                )
                              }
                              className="w-16 rounded border border-transparent p-1 text-right text-sm font-bold focus:border-indigo-300 dark:text-white"
                            />
                            <span className="ml-1 text-xs text-gray-400">
                              %
                            </span>
                          </div>
                        </td>
                        <td className="border-l border-gray-100 bg-gray-50/50 px-4 py-2 text-right dark:border-gray-800 dark:bg-gray-800/20">
                          <span className="block px-2 text-sm font-bold text-indigo-600 dark:text-indigo-400">
                            {formatCurrency(disbursement.amount)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button
                            type="button"
                            title="Hapus Termin"
                            onClick={() =>
                              handleRemoveDisbursement(disbursement.id)
                            }
                            className="mx-auto block rounded-lg p-1.5 text-gray-300 opacity-0 transition-colors hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-900/20"
                          >
                            <HiOutlineTrash className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div
                className={`mt-8 flex flex-col items-start justify-between gap-4 rounded-xl border p-4 shadow-inner sm:flex-row sm:items-center ${isValid || disbursements.length === 0 ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20" : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"}`}
              >
                <div className="flex flex-col">
                  <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    Total Persentase
                  </span>
                  <span
                    className={`text-2xl font-black ${isValid ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                  >
                    {totalPercentage}%
                  </span>
                </div>
                <div className="flex flex-col text-left sm:text-right">
                  <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                    Total Nominal Pencairan
                  </span>
                  <span
                    className={`text-2xl font-mono font-black ${isValid ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                  >
                    {formatCurrency(
                      calculatedDisbursements.reduce(
                        (sum, disbursement) => sum + (disbursement.amount || 0),
                        0,
                      ),
                    )}
                  </span>
                </div>
              </div>

              {!isValid && disbursements.length > 0 && (
                <p className="mt-2 rounded-lg border border-red-200 bg-red-100 px-4 py-3 text-sm font-bold text-red-600 dark:border-red-800 dark:bg-red-900/40 dark:text-red-300">
                  Validasi Error: Total persentase termin harus persis 100%.
                  Saat ini {totalPercentage}%.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-3 rounded-b-2xl border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-900/50">
          <button
            type="button"
            onClick={handleCloseModal}
            className="rounded-xl border border-gray-300 bg-white px-6 py-2.5 text-sm font-bold text-gray-600 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSaveDisbursements}
            disabled={!isValid && disbursements.length > 0}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-8 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-indigo-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
          >
            <HiOutlineCheck className="h-5 w-5" />
            Terapkan Termin
          </button>
        </div>
      </div>
    </div>
  );
}
