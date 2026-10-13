"use client";

import {
  HiOutlineArrowTrendingUp,
  HiOutlineBanknotes,
  HiOutlineCalculator,
  HiOutlineCube,
  HiOutlineCurrencyDollar,
  HiOutlinePlus,
  HiOutlineTrash,
} from "react-icons/hi2";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { buildHierarchicalOptions } from "../utils/rabFormHelpers";
import type { LocalItem, LocalDisbursement } from "../../ItemDisbursementModal";
import type { LocalWbs } from "../utils/rabFormPayloadBuilder";

interface ExpenseCategory {
  id: string;
  name: string;
  type: string;
  parentId?: string | null;
  code?: string;
}

interface RABFormItemsTabProps {
  items: LocalItem[];
  categories: ExpenseCategory[];
  wbsGroups: LocalWbs[];
  setWbsGroups: (groups: LocalWbs[]) => void;
  setItems: (items: LocalItem[]) => void;
  expenseTab: "CAPEX" | "OPEX";
  setExpenseTab: (tab: "CAPEX" | "OPEX") => void;
  handleAddItem: (type: "CAPEX" | "OPEX") => void;
  handleRemoveItem: (id: string) => void;
  updateItem: (
    id: string,
    field: string,
    value: string | number | string[] | LocalDisbursement[],
  ) => void;
  setActiveTerminItemId: (id: string | null) => void;
  projectedRevenue: number;
  nplTolerancePercent: number;
  totalCapex: number;
  totalOpex: number;
  totalInvestment: number;
  contingencyPercent: number;
  capexItems: LocalItem[];
  opexItems: LocalItem[];
  onChangeTab: (tab: "info" | "growth" | "items") => void;
}

export default function RABFormItemsTab({
  items,
  categories,
  wbsGroups,
  setWbsGroups,
  setItems,
  expenseTab,
  setExpenseTab,
  handleAddItem,
  handleRemoveItem,
  updateItem,
  setActiveTerminItemId,
  projectedRevenue,
  nplTolerancePercent,
  totalCapex,
  totalOpex,
  totalInvestment,
  contingencyPercent,
  capexItems,
  opexItems,
  onChangeTab,
}: RABFormItemsTabProps) {
  const currentTabItems = items.filter((i) => i.expenseType === expenseTab);

  return (
    <div className="space-y-6 p-4 animate-in fade-in slide-in-from-left-4 duration-500">
      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/10 dark:to-emerald-900/10 p-4 rounded-2xl border border-green-100 dark:border-green-900/30 group">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <HiOutlineCurrencyDollar className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Est. Pendapatan Realistis
            </span>
          </div>
          <div className="text-lg sm:text-xl font-black text-green-800 dark:text-green-400 font-mono tracking-tighter group-hover:scale-105 transition-transform origin-left my-1">
            {formatCurrency(projectedRevenue * (1 - nplTolerancePercent / 100))}
          </div>
          <div className="text-[9px] text-green-600/60 font-bold uppercase leading-tight">
            /Bulan (Dipotong NPL {nplTolerancePercent}%)
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-900/10 dark:to-fuchsia-900/10 p-4 rounded-2xl border border-purple-100 dark:border-purple-900/30 group">
          <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
            <HiOutlineCube className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Capex Dasar
            </span>
          </div>
          <div className="text-lg sm:text-xl font-black text-purple-800 dark:text-purple-400 font-mono tracking-tighter group-hover:scale-105 transition-transform origin-left my-1">
            {formatCurrency(totalCapex)}
          </div>
          <div className="text-[9px] text-purple-600/60 font-bold uppercase leading-tight">
            {capexItems.length} Komponen Investasi
          </div>
        </div>
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/10 dark:to-blue-900/10 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 group">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <HiOutlineCalculator className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Total Investasi
            </span>
          </div>
          <div className="text-lg sm:text-xl font-black text-indigo-800 dark:text-indigo-400 font-mono tracking-tighter group-hover:scale-105 transition-transform origin-left my-1">
            {formatCurrency(totalInvestment)}
          </div>
          <div className="text-[9px] text-indigo-600/60 font-bold uppercase leading-tight">
            Inc. Contingency {contingencyPercent}%
          </div>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10 p-4 rounded-2xl border border-orange-100 dark:border-orange-900/30 group">
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
            <HiOutlineBanknotes className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Total Opex
            </span>
          </div>
          <div className="text-lg sm:text-xl font-black text-orange-800 dark:text-orange-400 font-mono tracking-tighter group-hover:scale-105 transition-transform origin-left my-1">
            {formatCurrency(totalOpex)}
          </div>
          <div className="text-[9px] text-orange-600/60 font-bold uppercase leading-tight">
            {opexItems.length} Biaya Operasional/Bln
          </div>
        </div>
      </div>

      {/* Multi-Step Cost Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm flex flex-col">
        {/* Type Switcher */}
        <div className="flex p-2 bg-gray-50/80 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setExpenseTab("CAPEX")}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all duration-300 flex items-center justify-center gap-2 ${
              expenseTab === "CAPEX"
                ? "bg-white dark:bg-gray-800 text-purple-600 shadow-sm border border-purple-100 dark:border-purple-900/50"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <HiOutlineCube className="w-4 h-4" />
            INVESTASI AWAL (CAPEX)
          </button>
          <button
            type="button"
            onClick={() => setExpenseTab("OPEX")}
            className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all duration-300 flex items-center justify-center gap-2 ${
              expenseTab === "OPEX"
                ? "bg-white dark:bg-gray-800 text-orange-600 shadow-sm border border-orange-100 dark:border-orange-900/50"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <HiOutlineBanknotes className="w-4 h-4" />
            OPERASIONAL (OPEX)
          </button>
        </div>

        {/* Header Table Tool */}
        <div className="px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-800/20">
          <div className="flex flex-col w-full sm:w-auto">
            <span className="text-sm font-black text-gray-800 dark:text-gray-200">
              {expenseTab === "CAPEX"
                ? "Komponen Modal & Aset"
                : "Estimasi Biaya Bulanan"}
            </span>
            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">
              Total {expenseTab}:{" "}
              {formatCurrency(expenseTab === "CAPEX" ? totalCapex : totalOpex)}
            </span>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* WBS UI Manager */}
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                id="wbsInput"
                placeholder="Tambah Tahap WBS (Opsional)"
                className="w-full sm:w-48 px-3 py-1.5 text-xs rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-white"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const el = e.currentTarget;
                    if (el.value.trim()) {
                      setWbsGroups([
                        ...wbsGroups,
                        {
                          id: crypto.randomUUID(),
                          name: el.value.trim(),
                          order: wbsGroups.length,
                        },
                      ]);
                      el.value = "";
                    }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById(
                    "wbsInput",
                  ) as HTMLInputElement;
                  if (el && el.value.trim()) {
                    setWbsGroups([
                      ...wbsGroups,
                      {
                        id: crypto.randomUUID(),
                        name: el.value.trim(),
                        order: wbsGroups.length,
                      },
                    ]);
                    el.value = "";
                  }
                }}
                className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-bold transition-colors"
              >
                Tambah WBS
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleAddItem(expenseTab)}
              className={`flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-black text-white transition-all shadow-lg active:scale-95 whitespace-nowrap ${
                expenseTab === "CAPEX"
                  ? "bg-purple-600 hover:bg-purple-700 shadow-purple-500/20"
                  : "bg-orange-600 hover:bg-orange-700 shadow-orange-500/20"
              }`}
            >
              <HiOutlinePlus className="w-4 h-4" /> TAMBAH ITEM
            </button>
          </div>
        </div>

        {wbsGroups.length > 0 && (
          <div className="px-5 py-2 flex flex-wrap gap-2 border-b border-gray-100 dark:border-gray-700 bg-blue-50/50 dark:bg-blue-900/10">
            <span className="text-xs font-bold text-gray-500 mr-2 flex items-center">
              Grup WBS Tersedia:
            </span>
            {wbsGroups.map((wbs) => (
              <div
                key={wbs.id}
                className="flex items-center gap-1 bg-white dark:bg-gray-800 px-3 py-1 rounded-full text-[10px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
              >
                <span>{wbs.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setWbsGroups(wbsGroups.filter((w) => w.id !== wbs.id));
                    setItems(
                      items.map((i) =>
                        i.wbsGroupId === wbs.id
                          ? { ...i, wbsGroupId: undefined }
                          : i,
                      ),
                    );
                  }}
                  className="ml-1 text-red-400 hover:text-red-600"
                >
                  <HiOutlineTrash className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Items Interactive List */}
        <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
          {currentTabItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in duration-500">
              <div
                className={`p-6 rounded-full mb-4 ${expenseTab === "CAPEX" ? "bg-purple-50 text-purple-200" : "bg-orange-50 text-orange-200"}`}
              >
                {expenseTab === "CAPEX" ? (
                  <HiOutlineCube className="w-12 h-12" />
                ) : (
                  <HiOutlineBanknotes className="w-12 h-12" />
                )}
              </div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                Belum ada item {expenseTab} ditambahkan
              </p>
              <Button
                variant="link"
                size="sm"
                onClick={() => handleAddItem(expenseTab)}
                className="mt-4"
              >
                MULAI TAMBAH ITEM SEKARANG
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-gray-50/80 dark:bg-gray-900/50 text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest border-b dark:border-gray-700 sticky top-0 z-10 backdrop-blur-sm">
                  <tr>
                    <th className="px-6 py-4 w-[45%]">Nama Deskripsi</th>
                    <th className="px-4 py-4 w-[15%]">Kategori</th>
                    <th className="px-4 py-4 w-[10%] text-center">QTY</th>
                    <th className="px-4 py-4 w-[25%] text-right">
                      Harga Satuan (IDR)
                    </th>
                    <th className="px-6 py-4 w-[5%]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {currentTabItems.map((item) => (
                    <tr
                      key={item.id}
                      className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/5 transition-all"
                    >
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) =>
                            updateItem(item.id, "name", e.target.value)
                          }
                          className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm font-semibold placeholder-gray-300 dark:text-white mb-2"
                          placeholder="e.g., Mikrotik RB4011..."
                        />
                        {wbsGroups.length > 0 && expenseTab === "CAPEX" && (
                          <select
                            value={item.wbsGroupId || ""}
                            onChange={(e) =>
                              updateItem(item.id, "wbsGroupId", e.target.value)
                            }
                            className="w-full sm:w-11/12 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-1 text-[10px] text-gray-500"
                          >
                            <option value="">
                              -- Tidak Digrup (Opsional) --
                            </option>
                            {wbsGroups.map((wbs) => (
                              <option key={wbs.id} value={wbs.id}>
                                {wbs.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <Combobox
                          options={buildHierarchicalOptions(
                            categories,
                            item.expenseType,
                          )}
                          value={item.expenseCategoryId || ""}
                          onChange={(val) => {
                            updateItem(item.id, "expenseCategoryId", val);
                            const selectedCat = categories.find(
                              (c) => c.id === val,
                            );
                            if (selectedCat) {
                              const nameLower = selectedCat.name.toLowerCase();
                              let enumVal = "OTHER";
                              if (
                                nameLower.includes("perangkat") ||
                                nameLower.includes("device") ||
                                nameLower.includes("alat") ||
                                nameLower.includes("server") ||
                                nameLower.includes("router") ||
                                nameLower.includes("switch")
                              )
                                enumVal = "DEVICE";
                              else if (
                                nameLower.includes("kabel") ||
                                nameLower.includes("fo") ||
                                nameLower.includes("fiber")
                              )
                                enumVal = "CABLE";
                              else if (
                                nameLower.includes("aksesoris") ||
                                nameLower.includes("accessories") ||
                                nameLower.includes("material")
                              )
                                enumVal = "ACCESSORIES";
                              else if (
                                nameLower.includes("jasa") ||
                                nameLower.includes("service") ||
                                nameLower.includes("tukang") ||
                                nameLower.includes("instalasi")
                              )
                                enumVal = "SERVICE";
                              else if (
                                nameLower.includes("operasional") ||
                                nameLower.includes("bensin") ||
                                nameLower.includes("makan") ||
                                nameLower.includes("pulsa") ||
                                nameLower.includes("listrik")
                              )
                                enumVal = "OPERATIONAL";
                              updateItem(item.id, "category", enumVal);
                            }
                          }}
                          placeholder="Pilih Kategori COA..."
                        />
                      </td>
                      <td className="px-4 py-4">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(
                              item.id,
                              "quantity",
                              Number(e.target.value),
                            )
                          }
                          className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm text-center font-bold dark:text-white"
                        />
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex flex-col items-end">
                          <input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) =>
                              updateItem(
                                item.id,
                                "unitPrice",
                                Number(e.target.value),
                              )
                            }
                            className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm text-right font-black dark:text-white"
                            placeholder="0"
                          />
                          <span className="text-[10px] font-mono font-bold text-gray-400 mt-1">
                            {formatCurrency(item.quantity * item.unitPrice)}
                          </span>
                        </div>
                        <div className="mt-2 text-right">
                          <button
                            type="button"
                            onClick={() => setActiveTerminItemId(item.id)}
                            className={`text-[10px] px-2 py-1 rounded-md font-bold transition-all border ${
                              item.disbursements &&
                              item.disbursements.length > 0
                                ? "bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400"
                                : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700"
                            }`}
                          >
                            {item.disbursements && item.disbursements.length > 0
                              ? `Termin Aktif (${item.disbursements.length})`
                              : "+ Set Termin"}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-gray-300 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all opacity-0 group-hover:opacity-100"
                        >
                          <HiOutlineTrash className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-gray-100 dark:border-gray-800">
        <button
          type="button"
          onClick={() => onChangeTab("growth")}
          className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors group"
        >
          <div className="p-1.5 rounded-lg group-hover:bg-gray-100 dark:group-hover:bg-gray-800 transition-colors">
            <HiOutlineArrowTrendingUp className="w-5 h-5" />
          </div>
          Kembali ke Pertumbuhan
        </button>
        <div className="text-xs font-black text-gray-400 italic">
          Silahkan Simpan RAB setelah semua item & termin valid.
        </div>
      </div>
    </div>
  );
}
