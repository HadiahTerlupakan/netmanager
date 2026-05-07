import {
  HiOutlineArrowTrendingUp,
  HiOutlineBanknotes,
  HiOutlineCalculator,
  HiOutlineChartBar,
  HiOutlineCube,
  HiOutlineDocumentText,
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineUsers,
} from "react-icons/hi2";
import { formatCurrency } from "@/lib/utils";
import type { RabTargetBasis } from "@/modules/finance/client";
import type {
  CustomMilestone,
  LinearGrowthSettings,
  PercentageGrowthSettings,
  RABProject,
} from "../../rabTypes";

type GrowthType = NonNullable<RABProject["growthType"]>;

type CurrencyInputProps = {
  label: string;
  value: number;
  onChange?: (val: number) => void;
  placeholder?: string;
  readOnly?: boolean;
  helperText?: string;
};

function CurrencyInput({
  label,
  value,
  onChange,
  placeholder,
  readOnly = false,
  helperText,
}: CurrencyInputProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1.5">
        {label}
      </label>
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <span className="text-gray-500 dark:text-gray-400 sm:text-sm font-medium">
            Rp
          </span>
        </div>
        <input
          type="number"
          min="0"
          value={value || ""}
          onChange={(e) => onChange && onChange(Number(e.target.value))}
          readOnly={readOnly}
          className={`block w-full pl-10 pr-12 py-2.5 sm:text-sm border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 transition-shadow group-hover:shadow-sm dark:placeholder-gray-500 ${readOnly ? "bg-gray-100 dark:bg-gray-900 cursor-not-allowed text-gray-500 dark:text-gray-400" : "bg-white text-gray-900 dark:text-white"}`}
          placeholder={placeholder || "0"}
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <span className="text-gray-400 sm:text-xs">IDR</span>
        </div>
      </div>
      {(value > 0 || helperText) && (
        <div className="flex justify-between mt-1">
          {helperText && (
            <span className="text-xs text-gray-500 italic">{helperText}</span>
          )}
          {value > 0 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono text-right ml-auto">
              {formatCurrency(value)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface RABFormGrowthTabProps {
  targetBasis: RabTargetBasis;
  setTargetBasis: (basis: RabTargetBasis) => void;
  targetHomepass: number;
  setTargetHomepass: (value: number) => void;
  targetTakeUpRatePercent: number;
  setTargetTakeUpRatePercent: (value: number) => void;
  effectiveTargetSubscribers: number;
  setTargetSubscribers: (value: number) => void;
  arpu: number;
  setArpu: (value: number) => void;
  projectedRevenue: number;
  totalCapex: number;
  unitCosts: {
    costPerHomepass: number;
    costPerHomeconnectRevenue: number;
  };
  growthType: GrowthType;
  setGrowthType: (type: GrowthType) => void;
  paymentType: "PREPAID" | "POSTPAID";
  setPaymentType: (type: "PREPAID" | "POSTPAID") => void;
  linearSettings: LinearGrowthSettings;
  setLinearSettings: (settings: LinearGrowthSettings) => void;
  percentageSettings: PercentageGrowthSettings;
  setPercentageSettings: (settings: PercentageGrowthSettings) => void;
  customMilestones: CustomMilestone[];
  handleAddMilestone: () => void;
  updateMilestone: (
    index: number,
    field: "month" | "percent",
    value: number,
  ) => void;
  handleRemoveMilestone: (index: number) => void;
  previewSubscribers: number[];
  realisticBepMonths: number;
  margin: number;
  monthsToFullCapacity: number;
  simpleBepMonths: number;
  onChangeTab: (tab: "info" | "items") => void;
}

export default function RABFormGrowthTab({
  targetBasis,
  setTargetBasis,
  targetHomepass,
  setTargetHomepass,
  targetTakeUpRatePercent,
  setTargetTakeUpRatePercent,
  effectiveTargetSubscribers,
  setTargetSubscribers,
  arpu,
  setArpu,
  projectedRevenue,
  totalCapex,
  unitCosts,
  growthType,
  setGrowthType,
  paymentType,
  setPaymentType,
  linearSettings,
  setLinearSettings,
  percentageSettings,
  setPercentageSettings,
  customMilestones,
  handleAddMilestone,
  updateMilestone,
  handleRemoveMilestone,
  previewSubscribers,
  realisticBepMonths,
  margin,
  monthsToFullCapacity,
  simpleBepMonths,
  onChangeTab,
}: RABFormGrowthTabProps) {
  return (
    <div className="space-y-6 p-4 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                <HiOutlineUsers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Target & Pendapatan
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Basis Target RAB
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["HOMECONNECT", "HOMEPASS"] as RabTargetBasis[]).map(
                    (basis) => (
                      <button
                        key={basis}
                        type="button"
                        onClick={() => setTargetBasis(basis)}
                        className={`py-3 px-3 text-xs font-black rounded-xl border transition-all ${
                          targetBasis === basis
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20"
                            : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-indigo-300"
                        }`}
                      >
                        {basis === "HOMECONNECT"
                          ? "Homeconnect"
                          : "Homepass Dibangun"}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {targetBasis === "HOMEPASS" && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      Target Homepass
                    </label>
                    <div className="relative">
                      <HiOutlineUsers className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="number"
                        value={targetHomepass || ""}
                        onChange={(e) =>
                          setTargetHomepass(Number(e.target.value))
                        }
                        className="block w-full pl-10 pr-4 py-3 text-sm border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:bg-gray-800 dark:text-white"
                        placeholder="e.g., 500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                      Take-up Rate (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={targetTakeUpRatePercent}
                      onChange={(e) =>
                        setTargetTakeUpRatePercent(Number(e.target.value))
                      }
                      className="block w-full rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm py-3 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white"
                      placeholder="40"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  {targetBasis === "HOMEPASS"
                    ? "Target Homeconnect Revenue"
                    : "Target Pelanggan"}
                </label>
                <div className="relative">
                  <HiOutlineUsers className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="number"
                    value={effectiveTargetSubscribers || ""}
                    readOnly={targetBasis === "HOMEPASS"}
                    onChange={(e) =>
                      setTargetSubscribers(Number(e.target.value))
                    }
                    className={`block w-full pl-10 pr-4 py-3 text-sm border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white ${
                      targetBasis === "HOMEPASS"
                        ? "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                        : "dark:bg-gray-800"
                    }`}
                    placeholder="e.g., 200"
                  />
                </div>
              </div>
              <CurrencyInput
                label="ARPU (Harga Rata-rata/Bln)"
                value={arpu}
                onChange={setArpu}
                placeholder="150000"
              />
            </div>

            {projectedRevenue > 0 && (
              <div className="mt-5 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-900/30 flex justify-between items-center">
                <div className="text-xs font-bold text-green-700 dark:text-green-400 uppercase">
                  Potensi Revenue (Full Capacity)
                </div>
                <div className="text-lg font-black text-green-700 dark:text-green-400">
                  {formatCurrency(projectedRevenue)}/Bln
                </div>
              </div>
            )}
            {targetBasis === "HOMEPASS" && totalCapex > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
                  <div className="text-[10px] font-black text-blue-600 dark:text-blue-300 uppercase">
                    Biaya per Homepass
                  </div>
                  <div className="text-sm font-black text-blue-800 dark:text-blue-200">
                    {formatCurrency(unitCosts.costPerHomepass)}
                  </div>
                </div>
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                  <div className="text-[10px] font-black text-indigo-600 dark:text-indigo-300 uppercase">
                    Biaya per Homeconnect Revenue
                  </div>
                  <div className="text-sm font-black text-indigo-800 dark:text-indigo-200">
                    {formatCurrency(unitCosts.costPerHomeconnectRevenue)}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <HiOutlineArrowTrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Model Pertumbuhan
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-5">
              {(["LINEAR", "PERCENTAGE", "CUSTOM"] as GrowthType[]).map(
                (type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setGrowthType(type)}
                    className={`py-3 px-2 text-[10px] sm:text-xs font-black rounded-xl border transition-all duration-300 ${
                      growthType === type
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20"
                        : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-indigo-300"
                    }`}
                  >
                    {type === "LINEAR"
                      ? "LINEAR"
                      : type === "PERCENTAGE"
                        ? "PERSENTASE"
                        : "KUSTOM"}
                  </button>
                ),
              )}
            </div>

            <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <HiOutlineBanknotes className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                  Sistem Pembayaran
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(["PREPAID", "POSTPAID"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPaymentType(type)}
                    className={`p-3 text-left rounded-xl border transition-all duration-300 ${
                      paymentType === type
                        ? "bg-green-50 dark:bg-green-900/20 border-green-500 shadow-sm"
                        : "bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-green-300"
                    }`}
                  >
                    <div
                      className={`font-bold text-sm mb-1 ${paymentType === type ? "text-green-700 dark:text-green-400" : "text-gray-700 dark:text-gray-300"}`}
                    >
                      {type === "PREPAID"
                        ? "Prabayar (Prepaid)"
                        : "Pascabayar (Postpaid)"}
                    </div>
                    <div className="text-[10px] leading-tight opacity-80">
                      {type === "PREPAID"
                        ? "Bayar di awal bulan sebelum pemakaian."
                        : "Tagihan muncul di akhir bulan (Pake dulu baru bayar)."}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-inner mt-5 min-h-[140px]">
              {growthType === "LINEAR" && (
                <div className="animate-in fade-in zoom-in-95 duration-300">
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                    Penambahan Pelanggan / Bulan
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={linearSettings.subscribersPerMonth}
                      onChange={(e) =>
                        setLinearSettings({
                          subscribersPerMonth: Number(e.target.value),
                        })
                      }
                      className="block w-full py-3 px-4 text-sm border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:bg-gray-700"
                    />
                    <span className="text-sm font-bold text-gray-400">PLG</span>
                  </div>
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-700 dark:text-blue-300 leading-relaxed italic">
                    Target {effectiveTargetSubscribers} pelanggan akan tercapai
                    dalam ±
                    {linearSettings.subscribersPerMonth > 0
                      ? Math.ceil(
                          effectiveTargetSubscribers /
                            linearSettings.subscribersPerMonth,
                        )
                      : "∞"}{" "}
                    bulan secara konstan.
                  </div>
                </div>
              )}

              {growthType === "PERCENTAGE" && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                        % Awal (Bln 1)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={percentageSettings.initialPercent}
                          onChange={(e) =>
                            setPercentageSettings({
                              ...percentageSettings,
                              initialPercent: Number(e.target.value),
                            })
                          }
                          className="block w-full py-3 px-4 text-sm border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:bg-gray-700"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                          %
                        </span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                        Laju Pertumbuhan
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={percentageSettings.monthlyGrowthPercent}
                          onChange={(e) =>
                            setPercentageSettings({
                              ...percentageSettings,
                              monthlyGrowthPercent: Number(e.target.value),
                            })
                          }
                          className="block w-full py-3 px-4 text-sm border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:bg-gray-700"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 text-center italic">
                    Pelanggan akan bertambah{" "}
                    {percentageSettings.monthlyGrowthPercent}% dari target
                    setiap bulannya.
                  </p>
                </div>
              )}

              {growthType === "CUSTOM" && (
                <div className="space-y-3 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-gray-500 uppercase">
                      Target Bertahap (Milestone)
                    </span>
                    <button
                      type="button"
                      onClick={handleAddMilestone}
                      className="flex items-center gap-1 text-xs px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 transition-colors font-black"
                    >
                      <HiOutlinePlus className="w-3 h-3" /> TAMBAH
                    </button>
                  </div>
                  <div className="max-h-[160px] overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                    {customMilestones.map((milestone, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700/30 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700 group"
                      >
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">
                              Bln
                            </span>
                            <input
                              type="number"
                              value={milestone.month}
                              onChange={(e) =>
                                updateMilestone(
                                  index,
                                  "month",
                                  Number(e.target.value),
                                )
                              }
                              className="w-full py-1.5 px-2 text-sm border-gray-200 dark:border-gray-600 rounded-lg focus:ring-indigo-500 dark:bg-gray-700 font-bold"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase">
                              %
                            </span>
                            <input
                              type="number"
                              value={milestone.percent}
                              onChange={(e) =>
                                updateMilestone(
                                  index,
                                  "percent",
                                  Number(e.target.value),
                                )
                              }
                              className="w-full py-1.5 px-2 text-sm border-gray-200 dark:border-gray-600 rounded-lg focus:ring-indigo-500 dark:bg-gray-700 font-bold"
                            />
                          </div>
                        </div>
                        <div className="text-[10px] font-mono text-indigo-500 font-bold w-12 text-center">
                          {Math.round(
                            (milestone.percent / 100) *
                              effectiveTargetSubscribers,
                          )}{" "}
                          plg
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMilestone(index)}
                          className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm relative">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                  <HiOutlineChartBar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                  Proyeksi Pertumbuhan
                </h3>
              </div>
              <div className="text-[10px] font-black bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full">
                24 BULAN
              </div>
            </div>

            <div className="h-40 flex items-end gap-1.5 group/chart">
              {previewSubscribers.map((subscribers, index) => {
                const height =
                  effectiveTargetSubscribers > 0
                    ? (subscribers / effectiveTargetSubscribers) * 100
                    : 0;
                const isBepMonth = index + 1 === realisticBepMonths;

                return (
                  <div
                    key={index}
                    className={`flex-1 rounded-t-md transition-all duration-500 ease-out hover:brightness-110 relative ${
                      isBepMonth
                        ? "bg-green-500 shadow-lg shadow-green-500/20 z-10 scale-y-105"
                        : index + 1 < realisticBepMonths
                          ? "bg-red-400/80"
                          : "bg-indigo-500/90"
                    }`}
                    style={{ height: `${Math.max(height, 4)}%` }}
                  >
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[8px] py-1 px-1.5 rounded opacity-0 group-hover/chart:opacity-100 pointer-events-none transition-opacity z-20 whitespace-nowrap">
                      Bln {index + 1}: {subscribers}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 font-bold mt-3 border-t border-gray-100 dark:border-gray-700 pt-2">
              <span>AWAL</span>
              <span>TAHUN 1</span>
              <span>TAHUN 2</span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                { label: "Pra-BEP", color: "bg-red-400/80" },
                { label: "Titik BEP", color: "bg-green-500" },
                { label: "Profitabel", color: "bg-indigo-500/90" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div
                    className={`w-2.5 h-2.5 ${item.color} rounded-full`}
                  ></div>
                  <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div
            className={`rounded-2xl p-6 border transition-colors duration-500 ${
              margin > 20
                ? "bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-800"
                : margin > 0
                  ? "bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-800"
                  : "bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-800"
            }`}
          >
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <HiOutlineCalculator
                  className={`w-5 h-5 ${margin > 0 ? "text-blue-500" : "text-red-500"}`}
                />
              </div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                Kesimpulan BEP
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-y-6 gap-x-4">
              <div className="space-y-1">
                <div className="text-[10px] text-gray-400 uppercase font-black">
                  Full Capacity
                </div>
                <div className="text-xl font-black text-gray-900 dark:text-white">
                  Bulan {monthsToFullCapacity}
                </div>
              </div>
              <div className="space-y-1 text-right">
                <div className="text-[10px] text-gray-400 uppercase font-black">
                  BEP Realistis
                </div>
                <div
                  className={`text-xl font-black ${realisticBepMonths <= 18 ? "text-green-600" : realisticBepMonths <= 36 ? "text-blue-600" : "text-red-600"}`}
                >
                  {realisticBepMonths === Infinity
                    ? "∞"
                    : `Bulan ${realisticBepMonths}`}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-gray-400 uppercase font-black">
                  BEP Sederhana
                </div>
                <div className="text-lg font-bold text-gray-600 dark:text-gray-300">
                  {simpleBepMonths === Infinity
                    ? "∞"
                    : `${simpleBepMonths.toFixed(1)} Bln`}
                </div>
              </div>
              <div className="space-y-1 text-right">
                <div className="text-[10px] text-gray-400 uppercase font-black">
                  Gross Margin
                </div>
                <div
                  className={`text-lg font-black ${margin > 25 ? "text-green-600" : margin > 0 ? "text-blue-600" : "text-red-600"}`}
                >
                  {margin.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-gray-100 dark:border-gray-800">
        <button
          type="button"
          onClick={() => onChangeTab("info")}
          className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors group"
        >
          <div className="p-1.5 rounded-lg group-hover:bg-gray-100 dark:group-hover:bg-gray-800 transition-colors">
            <HiOutlineDocumentText className="w-5 h-5" />
          </div>
          Kembali ke Informasi
        </button>
        <button
          type="button"
          onClick={() => onChangeTab("items")}
          className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25 active:scale-95"
        >
          Lanjut: Detail Item & Biaya
          <HiOutlineCube className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
