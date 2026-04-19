"use client";

import { FiCheck, FiFilter, FiPackage, FiPlus, FiTrash2 } from "react-icons/fi";

import { Modal } from "@/components/ui/Modal";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

import {
  canRemoveRestockFormItem,
  canSubmitRestockForm,
  getMinStockForBarang,
  getRestockToggleHint,
  getRestockToggleLabel,
  getStockSnapshot,
  isVeryLowStock,
} from "./utils";
import type { Barang, Gudang, RestockFormItem, RestockSetting } from "./types";

interface RestockFormModalProps {
  isOpen: boolean;
  isEditing: boolean;
  formGudang: string;
  onFormGudangChange: (value: string) => void;
  formNotes: string;
  onFormNotesChange: (value: string) => void;
  formItems: RestockFormItem[];
  onFormItemsChange: (items: RestockFormItem[]) => void;
  gudangs: Gudang[];
  barangs: Barang[];
  allSettings: RestockSetting[];
  showAllItems: boolean;
  onShowAllItemsChange: (value: boolean) => void;
  loading: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

function createBarangOption(
  barang: Barang,
  allSettings: RestockSetting[],
  gudangId: string,
) {
  const stock = getStockSnapshot(barang, allSettings, gudangId);
  const minStock = getMinStockForBarang(barang, allSettings, gudangId);

  return {
    value: barang.id,
    label: `${barang.kode} - ${barang.nama}`,
    subLabel: `Baru: ${stock.stokBaru} (Limit: ${minStock})`,
    badge:
      stock.stokBaru <= minStock ? (
        <span className="px-2 py-0.5 bg-red-500 text-white text-[8px] font-black rounded-full uppercase">
          Min
        </span>
      ) : (
        <span className="px-2 py-0.5 bg-green-500 text-white text-[8px] font-black rounded-full uppercase">
          Ok
        </span>
      ),
  };
}

export function RestockFormModal({
  isOpen,
  isEditing,
  formGudang,
  onFormGudangChange,
  formNotes,
  onFormNotesChange,
  formItems,
  onFormItemsChange,
  gudangs,
  barangs,
  allSettings,
  showAllItems,
  onShowAllItemsChange,
  loading,
  submitting,
  onClose,
  onSubmit,
}: RestockFormModalProps) {
  const updateItem = (index: number, nextItem: RestockFormItem) => {
    const nextItems = [...formItems];
    nextItems[index] = nextItem;
    onFormItemsChange(nextItems);
  };

  const addItem = () => {
    onFormItemsChange([...formItems, { barangId: "", quantity: 1 }]);
  };

  const removeItem = (index: number) => {
    if (!canRemoveRestockFormItem(formItems.length)) {
      return;
    }

    onFormItemsChange(formItems.filter((_, itemIndex) => itemIndex !== index));
  };

  const isSubmitDisabled = !canSubmitRestockForm({
    formGudang,
    formItems,
    isSubmitting: submitting,
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? "Edit Pengajuan" : "Buat Pengajuan Restock"}
      size="3xl"
    >
      <div className="p-0 flex flex-col h-[85vh] md:h-auto overflow-hidden">
        <div className="p-6 space-y-8 overflow-y-auto flex-1 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-gray-50 dark:bg-gray-900/50 rounded-[2rem] border border-gray-100 dark:border-gray-800">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">
                <FiFilter className="text-indigo-500" /> Gudang Tujuan
              </label>
              <select
                value={formGudang}
                onChange={(event) => onFormGudangChange(event.target.value)}
                className="w-full bg-white dark:bg-gray-800 border-none rounded-2xl h-12 px-4 shadow-sm focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
              >
                <option value="">Pilih Gudang Terlebih Dahulu</option>
                {gudangs.map((gudang) => (
                  <option key={gudang.id} value={gudang.id}>
                    {gudang.nama}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[11px] font-black text-gray-400 uppercase tracking-widest ml-1">
                <FiPackage className="text-indigo-500" /> Catatan / Keterangan
              </label>
              <input
                type="text"
                value={formNotes}
                onChange={(event) => onFormNotesChange(event.target.value)}
                className="w-full bg-white dark:bg-gray-800 border-none rounded-2xl h-12 px-4 shadow-sm focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                placeholder="Contoh: Stok bulanan Site A"
              />
            </div>
          </div>

          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                  <FiPackage className="text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 dark:text-white tracking-tight">
                    Daftar Barang
                  </h3>
                  <p className="text-[11px] text-gray-500 font-bold uppercase tracking-tighter">
                    {getRestockToggleHint(showAllItems)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-2xl transition-all border ${showAllItems ? "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-100 dark:border-indigo-800" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"}`}
                >
                  <input
                    type="checkbox"
                    id="showAll"
                    checked={showAllItems}
                    onChange={(event) =>
                      onShowAllItemsChange(event.target.checked)
                    }
                    className="w-4 h-4 text-indigo-600 rounded-lg border-gray-300 focus:ring-indigo-500"
                  />
                  <label
                    htmlFor="showAll"
                    className={`text-[11px] font-black uppercase cursor-pointer select-none ${showAllItems ? "text-indigo-600" : "text-gray-500"}`}
                  >
                    {getRestockToggleLabel(showAllItems)}
                  </label>
                </div>
                <button
                  onClick={addItem}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-[11px] font-black uppercase rounded-2xl hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100 dark:shadow-none"
                >
                  <FiPlus /> Tambah
                </button>
              </div>
            </div>

            {!formGudang && (
              <div className="p-12 bg-blue-50/50 dark:bg-blue-900/5 border-2 border-dashed border-blue-100 dark:border-blue-900/20 rounded-[3rem] text-center">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/40 rounded-3xl flex items-center justify-center mx-auto mb-4 rotate-3">
                  <FiFilter className="text-blue-600 text-2xl" />
                </div>
                <p className="text-base text-blue-700 dark:text-blue-300 font-black">
                  Silakan Pilih Gudang
                </p>
                <p className="text-xs text-blue-500/70 dark:text-blue-400/70 mt-2 font-medium max-w-xs mx-auto text-balance text-center">
                  Sistem akan menyaring barang yang stoknya di bawah batas
                  minimal pada gudang tersebut.
                </p>
              </div>
            )}

            {formGudang &&
              barangs.length === 0 &&
              !loading &&
              !showAllItems && (
                <div className="p-12 bg-green-50/50 dark:bg-green-900/5 border-2 border-dashed border-green-100 dark:border-green-900/20 rounded-[3rem] text-center">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/40 rounded-3xl flex items-center justify-center mx-auto mb-4 -rotate-3">
                    <FiCheck className="text-green-600 text-2xl" />
                  </div>
                  <p className="text-base text-green-700 dark:text-green-300 font-black">
                    Semua Stok Aman
                  </p>
                  <p className="text-xs text-green-500/70 dark:text-green-400/70 mt-2 font-medium max-w-xs mx-auto text-balance text-center">
                    Tidak ada barang di bawah limit stok. Aktifkan mode semua
                    barang untuk restock manual.
                  </p>
                </div>
              )}

            <div className="space-y-5 pb-8">
              {formItems.map((item, index) => {
                const selectedBarang = barangs.find(
                  (barang) => barang.id === item.barangId,
                );
                const stock = getStockSnapshot(
                  selectedBarang,
                  allSettings,
                  formGudang,
                );
                const barangOptions = barangs.map((barang) =>
                  createBarangOption(barang, allSettings, formGudang),
                );
                const criticalLow = isVeryLowStock(
                  stock.stokBaru,
                  stock.minStock,
                );

                return (
                  <div
                    key={`${item.barangId}-${index}`}
                    className="group relative bg-white dark:bg-gray-800 p-5 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-xl hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all duration-300 animate-in fade-in slide-in-from-bottom-2"
                  >
                    <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center">
                      <div className="hidden lg:flex w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 items-center justify-center text-xs font-black text-indigo-400 border border-indigo-100 dark:border-indigo-800/50 group-hover:scale-110 transition-transform">
                        {index + 1}
                      </div>
                      <div className="flex-1 w-full space-y-3">
                        <SearchableSelect
                          options={barangOptions}
                          value={item.barangId}
                          onChange={(value) =>
                            updateItem(index, { ...item, barangId: value })
                          }
                          placeholder={
                            showAllItems
                              ? "Cari nama atau kode barang..."
                              : "Pilih barang stok rendah..."
                          }
                        />
                        {item.barangId && (
                          <div className="grid grid-cols-3 gap-2 sm:gap-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800/50">
                            <div className="flex flex-col items-center justify-center py-1">
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">
                                Stok Baru
                              </span>
                              <span
                                className={`text-sm font-black ${stock.stokBaru <= stock.minStock ? "text-red-500" : "text-indigo-600"}`}
                              >
                                {stock.stokBaru}
                              </span>
                            </div>
                            <div className="flex flex-col items-center justify-center py-1 border-x border-gray-200 dark:border-gray-800">
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">
                                Bekas
                              </span>
                              <span className="text-sm font-black text-blue-500">
                                {stock.stokBekas}
                              </span>
                            </div>
                            <div className="flex flex-col items-center justify-center py-1">
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">
                                Rusak
                              </span>
                              <span className="text-sm font-black text-orange-500">
                                {stock.stokRusak}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4 w-full lg:w-auto border-t lg:border-t-0 pt-4 lg:pt-0 lg:pl-6 lg:border-l border-gray-100 dark:border-gray-800">
                        <div className="flex-1 lg:flex-none flex flex-col space-y-1.5">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                            Jumlah Restock
                          </label>
                          <div className="flex items-center bg-gray-50 dark:bg-gray-900 rounded-2xl px-3 h-12 border border-gray-100 dark:border-gray-800 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(event) =>
                                updateItem(index, {
                                  ...item,
                                  quantity: parseInt(event.target.value) || 0,
                                })
                              }
                              className="w-full lg:w-24 bg-transparent border-none rounded-xl text-center font-black text-indigo-600 focus:ring-0 text-xl"
                            />
                            <span className="text-[10px] font-black text-gray-400 uppercase pr-1 hidden lg:block">
                              {selectedBarang?.satuan || ""}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeItem(index)}
                          className="p-3.5 text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-500 hover:text-white rounded-2xl transition-all duration-300 shadow-sm active:scale-90 mt-5"
                        >
                          <FiTrash2 className="text-lg" />
                        </button>
                      </div>
                    </div>
                    {item.barangId && criticalLow && (
                      <div className="absolute -top-2 -right-2 px-3 py-1 bg-red-500 text-white text-[9px] font-black uppercase rounded-full shadow-lg shadow-red-200 dark:shadow-none animate-bounce">
                        Critical Low
                      </div>
                    )}
                  </div>
                );
              })}

              {formItems.length > 0 && (
                <button
                  onClick={addItem}
                  className="w-full py-5 bg-gray-50 dark:bg-gray-900/50 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-[2.5rem] text-gray-400 text-xs font-black uppercase tracking-widest hover:text-indigo-600 hover:border-indigo-200 dark:hover:border-indigo-900/30 transition-all flex items-center justify-center gap-3"
                >
                  <FiPlus className="text-lg" /> Tambah Item Lainnya
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="p-8 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 rounded-b-[3rem]">
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-4 bg-gray-50 dark:bg-gray-900 text-gray-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-gray-100 dark:hover:bg-gray-800 transition-all active:scale-95"
            >
              Batal
            </button>
            <button
              onClick={onSubmit}
              disabled={isSubmitDisabled}
              className="flex-[2] px-6 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest disabled:opacity-30 shadow-2xl shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              {submitting ? (
                "Sedang Memproses..."
              ) : (
                <>
                  <FiCheck className="text-lg" /> Simpan Pengajuan
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
