import { formatCurrency } from "@/lib/utils";
import {
  HiOutlineBanknotes,
  HiOutlineBuildingOffice,
  HiOutlineChartBar,
  HiOutlineCheck,
  HiOutlinePencilSquare,
  HiOutlineUsers,
  HiOutlineXMark,
} from "react-icons/hi2";
import type { RABTrackingRow, RABTrackingTotals } from "./rabTracking";

interface RABTrackingEditForm {
  actualSubscribers: number;
  actualRevenue: string;
  manualRecoveryInstallment: string;
  manualInvestorShare: string;
  manualCompanyShare: string;
  manualInvestorProfitSharePercent: string;
}

interface RABTrackingSectionProps {
  rows: RABTrackingRow[];
  totals: RABTrackingTotals;
  editingMonth: number | null;
  editForm: RABTrackingEditForm;
  isSavingActual: boolean;
  nplTolerancePercent: number;
  onEditFormChange: (nextForm: RABTrackingEditForm) => void;
  onStartEdit: (
    monthIndex: number,
    defaultSubscribers: number,
    defaultRevenue: number,
  ) => void;
  onCancelEdit: () => void;
  onSaveEdit: (monthIndex: number) => void;
}

export default function RABTrackingSection({
  rows,
  totals,
  editingMonth,
  editForm,
  isSavingActual,
  nplTolerancePercent,
  onEditFormChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
}: RABTrackingSectionProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
            <HiOutlineChartBar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
            Tracking Pencapaian (Realisasi)
          </h3>
        </div>
      </div>

      <div className="p-0 overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800/50 sticky top-0 z-10">
            <tr>
              <th
                scope="col"
                className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase"
              >
                Periode
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase"
              >
                Gross Revenue
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-[10px] font-bold text-red-500 uppercase"
              >
                Potensi NPL
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-[10px] font-bold text-emerald-600 uppercase"
              >
                Net Revenue
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase"
              >
                OPEX
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-[10px] font-bold text-blue-600 uppercase"
              >
                Profit Kotor
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-[10px] font-bold text-amber-600 uppercase"
              >
                Angsuran Modal
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-[10px] font-bold text-orange-600 uppercase border-l border-gray-200 dark:border-gray-700"
              >
                Sisa Investasi
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-[10px] font-bold text-indigo-600 uppercase"
              >
                Investor Share
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-[10px] font-bold text-emerald-600 uppercase"
              >
                Company Share
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase"
              >
                Aksi
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {rows.map((row) => {
              const monthIndex = row.month;
              const isEditing = editingMonth === monthIndex;

              return (
                <tr
                  key={monthIndex}
                  className={
                    row.isAutoAssumed
                      ? "bg-gray-50/30 dark:bg-gray-900/20"
                      : "bg-emerald-50/20 dark:bg-emerald-900/10"
                  }
                >
                  <td className="px-4 py-3 whitespace-nowrap text-[11px] font-medium text-gray-900 dark:text-white">
                    Bln-{monthIndex}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right border-l border-gray-100 dark:border-gray-700/50 text-[11px] font-medium text-gray-700 dark:text-gray-200">
                    {formatCurrency(row.grossTargetRevenue)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-[11px] font-medium text-red-500">
                    {formatCurrency(row.nplAmount)}
                    <div className="text-[9px] text-gray-400 font-normal">
                      ({nplTolerancePercent || 0}%)
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    {isEditing ? (
                      <div className="flex flex-col gap-1 items-end">
                        <input
                          type="number"
                          value={editForm.actualRevenue}
                          onChange={(event) =>
                            onEditFormChange({
                              ...editForm,
                              actualRevenue: event.target.value,
                            })
                          }
                          className="w-24 text-right text-[11px] border-blue-300 dark:border-blue-700 rounded bg-blue-50/50 dark:bg-blue-900/50"
                          placeholder="Net Rev"
                        />
                        <span className="text-[9px] text-gray-400">
                          Target: {formatCurrency(row.projectedRevenue)}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end">
                        <span className="text-[11px] font-medium text-emerald-600">
                          {formatCurrency(row.displayRevenue)}
                        </span>
                        <span className="text-[9px] text-gray-400">
                          {row.actualRevenue !== null ? "Aktual" : "Proyeksi"}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-[11px] font-medium text-slate-500">
                    {formatCurrency(row.displayRevenue - row.grossProfit)}
                  </td>
                  <td
                    className={`px-4 py-3 whitespace-nowrap text-right text-[11px] font-medium ${row.grossProfit >= 0 ? "text-blue-600" : "text-red-500"}`}
                  >
                    {formatCurrency(row.grossProfit)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-[11px] font-medium text-amber-600">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editForm.manualRecoveryInstallment}
                        onChange={(event) =>
                          onEditFormChange({
                            ...editForm,
                            manualRecoveryInstallment: event.target.value,
                          })
                        }
                        className="w-24 text-right text-[11px] border-amber-300 dark:border-amber-700 rounded bg-amber-50/50 dark:bg-amber-900/50"
                        placeholder="Manual"
                      />
                    ) : (
                      <div className="flex flex-col items-end">
                        <span>{formatCurrency(row.recoveryInstallment)}</span>
                        {row.hasManualRecoveryInstallment && (
                          <span className="text-[8px] text-amber-500 font-bold uppercase">
                            Manual
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-[11px] font-mono border-l border-gray-100 dark:border-gray-700/50">
                    <div className="flex flex-col items-end">
                      <span
                        className={
                          row.remainingInvestment <= 100
                            ? "text-emerald-500 font-bold"
                            : "text-orange-600"
                        }
                      >
                        {formatCurrency(Math.max(0, row.remainingInvestment))}
                      </span>
                      {row.remainingInvestment <= 100 && (
                        <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1 rounded font-bold mt-0.5">
                          BEP!
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-[11px] font-medium text-indigo-600">
                    {isEditing ? (
                      <div className="flex flex-col gap-1 items-end">
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-gray-400">%</span>
                          <input
                            type="number"
                            value={editForm.manualInvestorProfitSharePercent}
                            onChange={(event) =>
                              onEditFormChange({
                                ...editForm,
                                manualInvestorProfitSharePercent:
                                  event.target.value,
                              })
                            }
                            className="w-12 text-right text-[11px] border-indigo-200 dark:border-indigo-800 rounded bg-indigo-50/30"
                            placeholder="%"
                          />
                        </div>
                        <input
                          type="number"
                          value={editForm.manualInvestorShare}
                          onChange={(event) =>
                            onEditFormChange({
                              ...editForm,
                              manualInvestorShare: event.target.value,
                            })
                          }
                          className="w-24 text-right text-[11px] border-indigo-300 dark:border-indigo-700 rounded bg-indigo-50/50 dark:bg-indigo-900/50"
                          placeholder="Amount"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-end">
                        <span>{formatCurrency(row.investorShare)}</span>
                        {row.hasManualInvestorProfitSharePercent && (
                          <span className="text-[8px] text-indigo-400">
                            {row.investorProfitSharePercent}% Share
                          </span>
                        )}
                        {row.hasManualInvestorShare && (
                          <span className="text-[8px] text-indigo-500 font-bold uppercase">
                            Manual Fixed
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-[11px] font-medium text-emerald-600">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editForm.manualCompanyShare}
                        onChange={(event) =>
                          onEditFormChange({
                            ...editForm,
                            manualCompanyShare: event.target.value,
                          })
                        }
                        className="w-24 text-right text-[11px] border-emerald-300 dark:border-emerald-700 rounded bg-emerald-50/50 dark:bg-emerald-900/50"
                        placeholder="Amount"
                      />
                    ) : (
                      <div className="flex flex-col items-end">
                        <span>{formatCurrency(row.companyShare)}</span>
                        {row.hasManualInvestorProfitSharePercent && (
                          <span className="text-[8px] text-emerald-400">
                            {100 - row.investorProfitSharePercent}% Share
                          </span>
                        )}
                        {row.hasManualCompanyShare && (
                          <span className="text-[8px] text-emerald-500 font-bold uppercase">
                            Manual Fixed
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    {isEditing ? (
                      <div className="flex gap-2 justify-center">
                        <button
                          type="button"
                          onClick={onCancelEdit}
                          disabled={isSavingActual}
                          className="p-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <HiOutlineXMark className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onSaveEdit(monthIndex)}
                          disabled={isSavingActual}
                          className="p-1 rounded text-white bg-blue-600 hover:bg-blue-700"
                        >
                          <HiOutlineCheck className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          onStartEdit(
                            monthIndex,
                            row.targetSubscribers,
                            row.displayRevenue,
                          )
                        }
                        className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        <HiOutlinePencilSquare className="w-3.5 h-3.5" /> Catat
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-100 dark:bg-gray-900 font-bold border-t-2 border-gray-200 dark:border-gray-700">
            <tr className="bg-gray-100 dark:bg-gray-900 border-t-2 border-gray-300 dark:border-gray-600">
              <td className="px-4 py-4 text-[10px] text-gray-700 dark:text-gray-300 font-bold uppercase">
                TOTAL AKUMULASI
              </td>
              <td className="px-4 py-4 text-right text-[11px] text-gray-900 dark:text-white border-l border-gray-200/50">
                {formatCurrency(totals.grossRevenue)}
              </td>
              <td className="px-4 py-4 text-right text-[11px] text-red-500 font-bold">
                {formatCurrency(totals.nplAmount)}
              </td>
              <td className="px-4 py-4 text-right text-[11px] text-emerald-600 font-bold">
                {formatCurrency(totals.revenue)}
              </td>
              <td className="px-4 py-4 text-right text-[11px] text-slate-500 font-bold">
                {formatCurrency(totals.opex)}
              </td>
              <td className="px-4 py-4 text-right text-[11px] text-blue-600 font-bold">
                {formatCurrency(totals.grossProfit)}
              </td>
              <td className="px-4 py-4 text-right text-[11px] text-amber-600 font-bold">
                {formatCurrency(totals.recoveryInstallment)}
              </td>
              <td className="px-4 py-4 text-right text-[11px] text-orange-600 border-l border-gray-200/50">
                <div className="flex flex-col items-end">
                  <span className="font-bold">
                    {formatCurrency(Math.max(0, totals.remainingInvestment))}
                  </span>
                  {totals.remainingInvestment <= 100 && (
                    <span className="text-[8px] text-emerald-500 font-bold uppercase">
                      LUNAS
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-4 text-right text-[11px] text-indigo-600 font-bold">
                <div className="flex flex-col items-end">
                  <span>{formatCurrency(totals.investorShare)}</span>
                  <span className="text-[8px] opacity-60 font-normal">
                    Profit Share
                  </span>
                </div>
              </td>
              <td className="px-4 py-4 text-right text-[11px] text-emerald-600 font-bold">
                <div className="flex flex-col items-end">
                  <span>{formatCurrency(totals.companyShare)}</span>
                  <span className="text-[8px] opacity-60 font-normal">
                    Profit Share
                  </span>
                </div>
              </td>
              <td className="px-4 py-4"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="p-4 bg-gray-50 dark:bg-gray-900/30 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
          <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
          Ringkasan Hak & Pembagian Keuntungan
          <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border-2 border-indigo-100 dark:border-indigo-900/30 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
              <HiOutlineBanknotes className="w-16 h-16 text-indigo-600" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
                  <HiOutlineUsers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  HAK INVESTOR
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">
                    Total Modal Kembali (CAPEX)
                  </span>
                  <span className="font-semibold text-amber-600">
                    {formatCurrency(totals.recoveryInstallment)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Total Bagi Hasil Profit</span>
                  <span className="font-semibold text-indigo-600">
                    {formatCurrency(totals.investorShare)}
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    TOTAL DITERIMA INVESTOR
                  </span>
                  <span className="text-lg font-black text-indigo-600">
                    {formatCurrency(totals.investorTotalReceived)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border-2 border-emerald-100 dark:border-emerald-900/30 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
              <HiOutlineBuildingOffice className="w-16 h-16 text-emerald-600" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
                  <HiOutlineBuildingOffice className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  HAK PERUSAHAAN
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Total Bagi Hasil Profit</span>
                  <span className="font-semibold text-emerald-600">
                    {formatCurrency(totals.companyShare)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs invisible">
                  <span className="text-gray-500">-</span>
                  <span className="font-semibold">-</span>
                </div>
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    TOTAL DITERIMA PERUSAHAAN
                  </span>
                  <span className="text-lg font-black text-emerald-600">
                    {formatCurrency(totals.companyTotalReceived)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
