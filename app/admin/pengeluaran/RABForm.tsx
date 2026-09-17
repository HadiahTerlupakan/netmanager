"use client";

import { useState, useMemo, type ComponentProps } from "react";
import {
  HiOutlineCalculator,
  HiOutlineCheck,
  HiOutlineBuildingOffice,
  HiOutlineDocumentText,
  HiOutlineCube,
  HiOutlineArrowTrendingUp,
  HiOutlineCalendar,
  HiOutlineChevronDown,
  HiOutlineChartBar,
  HiOutlineBanknotes,
} from "react-icons/hi2";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";

import {
  calculateMonthlySubscribers,
  calculateRealisticBEP,
} from "./rabCalculations";
import { buildRABTrackingDataset } from "./rabTracking";
import type {
  CustomGrowthSettings,
  GrowthSettings,
  LinearGrowthSettings,
  PercentageGrowthSettings,
  RABInvestorProfitShareMode,
  RABOpexBufferFundingMode,
  RABProject,
  RABDisbursement,
  RABWbs,
} from "./rabTypes";
import { Modal } from "@/components/ui/Modal";
import ItemDisbursementModal from "./ItemDisbursementModal";
import {
  DEFAULT_OPEX_BUFFER_SETTINGS,
  getDefaultOpexBufferShares,
  shouldShowOpexBufferSafety,
} from "./RABForm/utils/rabFormHelpers";
import { validateRABForm } from "./RABForm/utils/rabFormValidation";
import { buildRABPayload } from "./RABForm/utils/rabFormPayloadBuilder";
import { useRABExternalData } from "./RABForm/hooks/useRABExternalData";
import { useRABTargetRevenue } from "./RABForm/hooks/useRABTargetRevenue";
import { useRABGrowthModel } from "./RABForm/hooks/useRABGrowthModel";
import { useRABItems } from "./RABForm/hooks/useRABItems";
import { useRABCalculations } from "./RABForm/hooks/useRABCalculations";
import RABFormGrowthTab from "./RABForm/tabs/RABFormGrowthTab";
import RABFormItemsTab from "./RABForm/tabs/RABFormItemsTab";
import type { SiteOption } from "./expenses.types";

interface RABFormProps {
  isOpen: boolean;
  initialData?: RABProject | null;
  sites: SiteOption[];
  onSaved: () => void;
  onClose: () => void;
}

type MainTab = "info" | "growth" | "items" | "disbursement";
type ExpenseType = "CAPEX" | "OPEX";
type GrowthType = NonNullable<RABProject["growthType"]>;
type FormSubmitEvent = Parameters<
  NonNullable<ComponentProps<"form">["onSubmit"]>
>[0];

export default function RABForm({
  isOpen,
  initialData,
  sites,
  onSaved,
  onClose,
}: RABFormProps) {
  const [mainTab, setMainTab] = useState<MainTab>("info");
  const [expenseTab, setExpenseTab] = useState<ExpenseType>("CAPEX");

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    siteId: "",
    status: "DRAFT",
    startDate: "",
    investmentDurationMonths: 12,
    investmentRecoveryType: "PERCENTAGE" as "PERCENTAGE" | "FIXED",
    investmentRecoveryValue: 50, // Defaults to 50%
    investorProfitSharePercent: 50,
    investorProfitShareMode: "FLAT" as RABInvestorProfitShareMode,
    investorProfitShareBeforeBepPercent: 80,
    investorProfitShareAfterBepPercent: 60,
    nplTolerancePercent: 0,
    contingencyPercent: 0,
    ...DEFAULT_OPEX_BUFFER_SETTINGS,
    hasDisbursementPlan: false,
    investorIds: [] as string[],
  });

  // Items & WBS state
  const {
    items,
    setItems,
    wbsGroups,
    setWbsGroups,
    activeTerminItemId,
    setActiveTerminItemId,
    handleAddItem,
    handleRemoveItem,
    updateItem,
  } = useRABItems();

  // Target & Revenue state
  const {
    targetBasis,
    setTargetBasis,
    targetHomepass,
    setTargetHomepass,
    targetTakeUpRatePercent,
    setTargetTakeUpRatePercent,
    targetSubscribers,
    setTargetSubscribers,
    arpu,
    setArpu,
    paymentType,
    setPaymentType,
  } = useRABTargetRevenue();

  // Growth period state
  const {
    growthType,
    setGrowthType,
    linearSettings,
    setLinearSettings,
    percentageSettings,
    setPercentageSettings,
    customMilestones,
    setCustomMilestones,
    currentGrowthSettings,
  } = useRABGrowthModel();

  // Fetch external data (categories & investors)
  const { categories, investorsList } = useRABExternalData();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInvestorDropdownOpen, setIsInvestorDropdownOpen] = useState(false);

  // Initialize data if editing when modal opens — pattern: prevProp comparator
  // (digantikan pattern useEffect lama untuk menghindari setState in effect)
  const [prevModalSnapshot, setPrevModalSnapshot] = useState({
    isOpen,
    initialDataId: initialData?.id ?? null,
  });
  const currentSnapshot = {
    isOpen,
    initialDataId: initialData?.id ?? null,
  };
  if (
    prevModalSnapshot.isOpen !== currentSnapshot.isOpen ||
    prevModalSnapshot.initialDataId !== currentSnapshot.initialDataId
  ) {
    setPrevModalSnapshot(currentSnapshot);
    if (isOpen) {
      if (initialData) {
        setFormData({
          name: initialData.name || "",
          description: initialData.description || "",
          siteId: initialData.siteId || "",
          status: initialData.status || "DRAFT",
          startDate: initialData.startDate
            ? new Date(initialData.startDate).toISOString().split("T")[0]
            : "",
          investmentDurationMonths: initialData.investmentDurationMonths || 12,
          investmentRecoveryType:
            initialData.investmentRecoveryType || "PERCENTAGE",
          investmentRecoveryValue: initialData.investmentRecoveryValue || 50,
          investorProfitSharePercent:
            initialData.investorProfitSharePercent || 50,
          investorProfitShareMode:
            initialData.investorProfitShareMode || "FLAT",
          investorProfitShareBeforeBepPercent:
            initialData.investorProfitShareBeforeBepPercent ?? 80,
          investorProfitShareAfterBepPercent:
            initialData.investorProfitShareAfterBepPercent ?? 60,
          nplTolerancePercent:
            (initialData.nplTolerancePercent as number | undefined) || 0,
          contingencyPercent: initialData.contingencyPercent || 0,
          opexBufferFundingMode:
            initialData.opexBufferFundingMode || "INVESTOR",
          opexBufferInvestorPercent:
            initialData.opexBufferInvestorPercent ?? 100,
          opexBufferCompanyPercent: initialData.opexBufferCompanyPercent ?? 0,
          opexBufferInvestorFixedAmount: Number(
            initialData.opexBufferInvestorFixedAmount || 0,
          ),
          opexBufferSafetyPercent: initialData.opexBufferSafetyPercent ?? 0,
          hasDisbursementPlan: initialData.hasDisbursementPlan || false,
          investorIds:
            initialData.investors?.map(
              (i: { investorId: string }) => i.investorId,
            ) || [],
        });

        setTargetBasis(initialData.targetBasis || "HOMECONNECT");
        setTargetHomepass(initialData.targetHomepass || 0);
        setTargetTakeUpRatePercent(initialData.targetTakeUpRatePercent ?? 40);
        // Load target & arpu - logic fixed to handle 0 values
        if (
          initialData.targetSubscribers !== undefined &&
          initialData.targetSubscribers !== null
        ) {
          setTargetSubscribers(initialData.targetSubscribers);
        }
        if (initialData.arpu !== undefined && initialData.arpu !== null) {
          setArpu(Number(initialData.arpu));
        }
        if (initialData.paymentType) {
          setPaymentType(initialData.paymentType as "PREPAID" | "POSTPAID");
        }

        // Load growth settings
        if (initialData.growthType)
          setGrowthType(initialData.growthType as GrowthType);
        if (initialData.growthSettings) {
          const settings = initialData.growthSettings as GrowthSettings;
          if ("subscribersPerMonth" in settings) {
            setLinearSettings(settings as LinearGrowthSettings);
          } else if ("initialPercent" in settings) {
            setPercentageSettings(settings as PercentageGrowthSettings);
          } else if ("milestones" in settings) {
            setCustomMilestones((settings as CustomGrowthSettings).milestones);
          }
        }

        // Load items
        if (initialData.items) {
          setItems(
            initialData.items.map((item) => ({
              id: item.id,
              name: item.name,
              category: item.category,
              expenseCategoryId: item.expenseCategoryId || undefined,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              expenseType: item.expenseType || "CAPEX",
              wbsGroupId: item.wbsId || item.wbsGroupId || undefined,
              disbursements: (item.disbursements || []).map(
                (d: RABDisbursement) => ({
                  id: d.id,
                  name: d.name,
                  percentage: d.percentage,
                  amount: Number(d.amount),
                  estimatedDate: d.estimatedDate
                    ? new Date(d.estimatedDate).toISOString().split("T")[0]
                    : "",
                  isPaid: d.isPaid || false,
                }),
              ),
            })),
          );
        } else {
          setItems([]);
        }

        // Load WBS
        setWbsGroups(
          (initialData.wbsGroups || []).map((w: RABWbs) => ({
            id: w.id,
            name: w.name,
            order: w.order,
          })),
        );
      } else {
        // Reset form
        setFormData({
          name: "",
          description: "",
          siteId: "",
          status: "DRAFT",
          startDate: "",
          investmentDurationMonths: 12,
          investmentRecoveryType: "PERCENTAGE",
          investmentRecoveryValue: 50,
          investorProfitSharePercent: 50,
          investorProfitShareMode: "FLAT",
          investorProfitShareBeforeBepPercent: 80,
          investorProfitShareAfterBepPercent: 60,
          nplTolerancePercent: 0,
          contingencyPercent: 0,
          ...DEFAULT_OPEX_BUFFER_SETTINGS,
          hasDisbursementPlan: false,
          investorIds: [],
        });
        setTargetBasis("HOMECONNECT");
        setTargetHomepass(0);
        setTargetTakeUpRatePercent(40);
        setTargetSubscribers(0);
        setArpu(0);
        setPaymentType("PREPAID");
        setGrowthType("LINEAR");
        setLinearSettings({ subscribersPerMonth: 10 });
        setPercentageSettings({ initialPercent: 10, monthlyGrowthPercent: 15 });
        setCustomMilestones([
          { month: 3, percent: 30 },
          { month: 6, percent: 60 },
          { month: 12, percent: 100 },
        ]);
        setItems([
          {
            id: crypto.randomUUID(),
            name: "",
            category: "DEVICE",
            quantity: 1,
            unitPrice: 0,
            expenseType: "CAPEX",
            disbursements: [],
          },
        ]);
        setWbsGroups([]);
        setMainTab("info");
        setExpenseTab("CAPEX");
      }
    }
  }

  const handleAddMilestone = () => {
    const lastMonth =
      customMilestones.length > 0
        ? Math.max(...customMilestones.map((m) => m.month))
        : 0;
    setCustomMilestones([
      ...customMilestones,
      { month: lastMonth + 3, percent: 100 },
    ]);
  };

  const handleRemoveMilestone = (index: number) => {
    setCustomMilestones(customMilestones.filter((_, i) => i !== index));
  };

  const updateMilestone = (
    index: number,
    field: "month" | "percent",
    value: number,
  ) => {
    setCustomMilestones(
      customMilestones.map((m, i) =>
        i === index ? { ...m, [field]: value } : m,
      ),
    );
  };

  // Calculations
  const {
    capexItems,
    opexItems,
    totalCapex,
    totalOpex,
    contingencyAmount,
    totalInvestment,
    effectiveTargetSubscribers,
    unitCosts,
    projectedRevenue,
    realisticRevenue: _realisticRevenue,
    profitPerMonth: _profitPerMonth,
    simpleBepMonths,
    margin,
    previewProject,
  } = useRABCalculations({
    items,
    formData,
    targetBasis,
    targetHomepass,
    targetTakeUpRatePercent,
    targetSubscribers,
    arpu,
    paymentType,
    growthType,
    currentGrowthSettings,
  });

  const opexBufferPreview = useMemo(() => {
    return buildRABTrackingDataset(previewProject).totals;
  }, [previewProject]);
  const showSafetyMargin = shouldShowOpexBufferSafety(
    formData.opexBufferFundingMode,
  );

  // Realistic BEP with growth
  const realisticBepData = useMemo(() => {
    return calculateRealisticBEP(previewProject);
  }, [previewProject]);

  const realisticBepMonths = realisticBepData.bepMonth;
  const monthsToFullCapacity = realisticBepData.monthsToFullCapacity;

  // Preview chart data (24 months)
  const previewSubscribers = useMemo(() => {
    return calculateMonthlySubscribers(
      effectiveTargetSubscribers,
      growthType,
      currentGrowthSettings,
      24,
    );
  }, [effectiveTargetSubscribers, growthType, currentGrowthSettings]);

  const handleSubmit = async (e: FormSubmitEvent) => {
    e.preventDefault();

    // Comprehensive validation with clear messages
    const validation = validateRABForm(formData, items);

    if (!validation.isValid) {
      toast.error(
        `Mohon perbaiki data berikut:\n${validation.errors.map((e) => `- ${e}`).join("\n")}`,
        { duration: 6000 },
      );
      if (validation.targetTab) {
        setMainTab(validation.targetTab);
      }
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = buildRABPayload({
        formData,
        projectedRevenue,
        totalOpex,
        targetBasis,
        targetHomepass,
        targetTakeUpRatePercent,
        effectiveTargetSubscribers,
        arpu,
        paymentType,
        growthType,
        currentGrowthSettings,
        contingencyAmount,
        wbsGroups,
        items,
      });

      const url = initialData
        ? `/api/finance/rab-projects/${initialData.id}`
        : "/api/finance/rab-projects";

      const method = initialData ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Gagal menyimpan RAB");
      }

      toast.success(initialData ? "RAB diperbarui" : "RAB dibuat");
      onSaved();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Terjadi kesalahan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const mainTabs = [
    {
      id: "info" as MainTab,
      label: "Informasi Proyek",
      icon: HiOutlineDocumentText,
    },
    {
      id: "growth" as MainTab,
      label: "Periode Pertumbuhan",
      icon: HiOutlineArrowTrendingUp,
    },
    { id: "items" as MainTab, label: "Item & Biaya", icon: HiOutlineCube },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "Edit RAB Proyek" : "Buat RAB Proyek Baru"}
      size="4xl"
    >
      <form onSubmit={handleSubmit} className="animate-in fade-in duration-300">
        {/* Wizard Stepper Headers */}
        <div className="flex items-center justify-between mb-8 px-4 relative">
          {/* Background Line */}
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 dark:bg-gray-700 -translate-y-1/2 z-0 hidden sm:block"></div>

          {mainTabs.map((tab, idx) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMainTab(tab.id)}
              className="relative z-10 flex flex-col items-center group"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  mainTab === tab.id
                    ? "bg-blue-600 border-blue-600 text-white shadow-lg scale-110"
                    : mainTabs.findIndex((t) => t.id === mainTab) > idx
                      ? "bg-green-500 border-green-500 text-white"
                      : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400 group-hover:border-blue-400"
                }`}
              >
                {mainTabs.findIndex((t) => t.id === mainTab) > idx ? (
                  <HiOutlineCheck className="w-6 h-6" />
                ) : (
                  <tab.icon className="w-5 h-5" />
                )}
              </div>
              <span
                className={`mt-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-colors duration-300 ${
                  mainTab === tab.id
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-400"
                }`}
              >
                {tab.label.split(" ")[0]}
              </span>
            </button>
          ))}
        </div>

        {/* Tab Content Wrapper */}
        <div className="bg-white dark:bg-gray-900/50 rounded-2xl border border-gray-200 dark:border-gray-800 p-1 sm:p-2 min-h-[450px]">
          {/* Tab 1: Informasi Proyek */}
          {mainTab === "info" && (
            <div className="space-y-6 p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: Basic Info */}
                <div className="md:col-span-2 space-y-5">
                  <div className="bg-gray-50/50 dark:bg-gray-800/30 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <HiOutlineDocumentText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                        Identitas Proyek
                      </h3>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                          Nama Proyek <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                          className="block w-full rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 py-3 dark:text-white transition-all"
                          placeholder="e.g., Ekspansi Jaringan Cluster Wijaya - Tahap 1"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                            Pilih Area/Site Internal
                          </label>
                          <div className="relative">
                            <HiOutlineBuildingOffice className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <select
                              value={formData.siteId}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  siteId: e.target.value,
                                })
                              }
                              className="block w-full pl-10 rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white appearance-none"
                            >
                              <option value="">
                                -- Pilih Site Internal --
                              </option>
                              {sites.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <p className="mt-1 text-[10px] text-gray-500 italic">
                            Otomatis kalkulasi dari pelanggan internet yang
                            berstatus AKTIF di wilayah ini.
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                            Estimasi Mulai
                          </label>
                          <div className="relative">
                            <HiOutlineCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                              type="date"
                              value={formData.startDate}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  startDate: e.target.value,
                                })
                              }
                              className="block w-full pl-10 rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                            Durasi Kontrak (Bulan)
                          </label>
                          <div className="relative">
                            <HiOutlineChartBar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                              type="number"
                              min="1"
                              max="240"
                              value={formData.investmentDurationMonths}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  investmentDurationMonths:
                                    parseInt(e.target.value) || 1,
                                })
                              }
                              className="block w-full pl-10 rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                              placeholder="12"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-gray-100 dark:border-gray-700 mt-4">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                            <HiOutlineBanknotes className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                          </div>
                          <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                            Investor & Profit Sharing
                          </h3>
                        </div>

                        <div className="mb-4">
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                            Investor
                          </label>
                          <p className="text-xs text-gray-500 mb-2">
                            Pilih investor yang mendanai proyek ini (Bisa
                            multipel)
                          </p>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setIsInvestorDropdownOpen(
                                  !isInvestorDropdownOpen,
                                )
                              }
                              className="w-full text-left bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl py-3 px-4 text-sm flex justify-between items-center focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                            >
                              <span className="truncate text-gray-700 dark:text-gray-200">
                                {formData.investorIds.length > 0
                                  ? `${formData.investorIds.length} Investor Dipilih`
                                  : "Pilih Investor..."}
                              </span>
                              <HiOutlineChevronDown
                                className={`w-4 h-4 text-gray-400 transition-transform ${isInvestorDropdownOpen ? "rotate-180" : ""}`}
                              />
                            </button>

                            {isInvestorDropdownOpen && (
                              <>
                                <div
                                  className="fixed inset-0 z-[50]"
                                  onClick={() =>
                                    setIsInvestorDropdownOpen(false)
                                  }
                                />
                                <div className="absolute z-[60] mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                                  {investorsList.length === 0 ? (
                                    <div className="p-4 text-xs text-gray-500 text-center italic">
                                      Belum ada investor terdaftar.
                                    </div>
                                  ) : (
                                    <div className="p-2 space-y-1">
                                      {investorsList.map((inf) => {
                                        const isSelected =
                                          formData.investorIds.includes(inf.id);
                                        return (
                                          <label
                                            key={inf.id}
                                            className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                                          >
                                            <div className="flex items-center gap-3">
                                              <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => {
                                                  setFormData((prev) => ({
                                                    ...prev,
                                                    investorIds: isSelected
                                                      ? prev.investorIds.filter(
                                                          (id) => id !== inf.id,
                                                        )
                                                      : [
                                                          ...prev.investorIds,
                                                          inf.id,
                                                        ],
                                                  }));
                                                }}
                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                              />
                                              <span
                                                className={`text-sm ${isSelected ? "font-bold text-gray-900 dark:text-white" : "text-gray-700 dark:text-gray-300"}`}
                                              >
                                                {inf.namaLengkap}
                                              </span>
                                            </div>
                                            {isSelected && (
                                              <HiOutlineCheck className="w-4 h-4 text-blue-600" />
                                            )}
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                              Komitmen Pengembalian Modal
                            </label>
                            <select
                              value={formData.investmentRecoveryType}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  investmentRecoveryType: e.target.value as
                                    | "PERCENTAGE"
                                    | "FIXED",
                                })
                              }
                              className="block w-full rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                            >
                              <option value="PERCENTAGE">
                                Persentase dari Profit
                              </option>
                              <option value="FIXED">
                                Nilai Tetap per Bulan
                              </option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                              {formData.investmentRecoveryType === "PERCENTAGE"
                                ? "Persen Pengembalian dari Profit (%)"
                                : "Nilai Pengembalian per Bulan (IDR)"}
                            </label>
                            <input
                              type="number"
                              value={formData.investmentRecoveryValue}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  investmentRecoveryValue: Number(
                                    e.target.value,
                                  ),
                                })
                              }
                              className="block w-full rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                              placeholder={
                                formData.investmentRecoveryType === "PERCENTAGE"
                                  ? "50"
                                  : "1.000.000"
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                              Skema Bagi Hasil
                            </label>
                            <select
                              value={formData.investorProfitShareMode}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  investorProfitShareMode: e.target
                                    .value as RABInvestorProfitShareMode,
                                })
                              }
                              className="block w-full rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                            >
                              <option value="FLAT">Tetap</option>
                              <option value="TIERED_AFTER_BEP">
                                Bertahap Setelah Balik Modal
                              </option>
                            </select>
                          </div>

                          {formData.investorProfitShareMode === "FLAT" ? (
                            <>
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                  Bagi Hasil Investor (%)
                                </label>
                                <input
                                  type="number"
                                  max="100"
                                  min="0"
                                  value={formData.investorProfitSharePercent}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      investorProfitSharePercent: Number(
                                        e.target.value,
                                      ),
                                    })
                                  }
                                  className="block w-full rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                  Bagi Hasil Perusahaan (%)
                                </label>
                                <input
                                  type="number"
                                  value={
                                    100 - formData.investorProfitSharePercent
                                  }
                                  readOnly
                                  className="block w-full rounded-xl border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-sm py-3 text-gray-500 dark:text-gray-400"
                                />
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                  Investor Sebelum Balik Modal (%)
                                </label>
                                <input
                                  type="number"
                                  max="100"
                                  min="0"
                                  value={
                                    formData.investorProfitShareBeforeBepPercent
                                  }
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      investorProfitShareBeforeBepPercent:
                                        Number(e.target.value),
                                    })
                                  }
                                  className="block w-full rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                                />
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  Perusahaan:{" "}
                                  {100 -
                                    formData.investorProfitShareBeforeBepPercent}
                                  %
                                </p>
                              </div>
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                  Investor Setelah Balik Modal (%)
                                </label>
                                <input
                                  type="number"
                                  max="100"
                                  min="0"
                                  value={
                                    formData.investorProfitShareAfterBepPercent
                                  }
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      investorProfitShareAfterBepPercent:
                                        Number(e.target.value),
                                    })
                                  }
                                  className="block w-full rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                                />
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  Perusahaan:{" "}
                                  {100 -
                                    formData.investorProfitShareAfterBepPercent}
                                  %
                                </p>
                              </div>
                            </>
                          )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                Biaya Tak Terduga / Contingency (%)
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={formData.contingencyPercent}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      contingencyPercent: Number(
                                        e.target.value,
                                      ),
                                    })
                                  }
                                  className="block w-full rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm py-3 pr-10 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                                  placeholder="5"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                                  %
                                </span>
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                Estimasi Nominal Contingency
                              </label>
                              <input
                                type="text"
                                value={formatCurrency(contingencyAmount)}
                                readOnly
                                className="block w-full rounded-xl border-transparent bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 font-bold text-sm py-3"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                Toleransi NPL / Bad Debt (%)
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={formData.nplTolerancePercent || 0}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      nplTolerancePercent: Number(
                                        e.target.value,
                                      ),
                                    })
                                  }
                                  className="block w-full rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm py-3 pr-10 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                                  placeholder="Misal: 5"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                                  %
                                </span>
                              </div>
                              <p className="mt-2 text-xs text-gray-500">
                                Pemotongan estimasi Pendapatan Realistis untuk
                                antisipasi NPL pelangggan secara keseluruhan.
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                Pendapatan Realistis / Bulan
                              </label>
                              <input
                                type="text"
                                value={formatCurrency(
                                  projectedRevenue *
                                    (1 -
                                      (formData.nplTolerancePercent || 0) /
                                        100),
                                )}
                                readOnly
                                className="block w-full rounded-xl border-transparent bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-bold text-sm py-3"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                Skema Buffer OPEX Ramp-up
                              </label>
                              <select
                                value={formData.opexBufferFundingMode}
                                onChange={(e) => {
                                  const mode = e.target
                                    .value as RABOpexBufferFundingMode;
                                  const shares =
                                    getDefaultOpexBufferShares(mode);
                                  setFormData({
                                    ...formData,
                                    opexBufferFundingMode: mode,
                                    opexBufferInvestorPercent:
                                      shares.investorPercent,
                                    opexBufferCompanyPercent:
                                      shares.companyPercent,
                                    opexBufferSafetyPercent:
                                      shouldShowOpexBufferSafety(mode)
                                        ? formData.opexBufferSafetyPercent
                                        : 0,
                                  });
                                }}
                                className="block w-full rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                              >
                                <option value="INVESTOR">Investor Penuh</option>
                                <option value="COMPANY">
                                  Perusahaan Penuh
                                </option>
                                <option value="SHARED_PERCENTAGE">
                                  Sharing Persentase
                                </option>
                                <option value="FIXED">
                                  Investor Fixed Amount
                                </option>
                              </select>
                            </div>
                            {showSafetyMargin && (
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                  Safety Margin Buffer (%)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={formData.opexBufferSafetyPercent}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      opexBufferSafetyPercent: Number(
                                        e.target.value,
                                      ),
                                    })
                                  }
                                  className="block w-full rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                                />
                                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                  Tambahan cadangan di atas gap OPEX ramp-up.
                                </p>
                              </div>
                            )}
                            {formData.opexBufferFundingMode ===
                              "SHARED_PERCENTAGE" && (
                              <>
                                <div>
                                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                    Porsi Investor Buffer (%)
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={formData.opexBufferInvestorPercent}
                                    onChange={(e) => {
                                      const investorPercent = Number(
                                        e.target.value,
                                      );
                                      setFormData({
                                        ...formData,
                                        opexBufferInvestorPercent:
                                          investorPercent,
                                        opexBufferCompanyPercent:
                                          100 - investorPercent,
                                      });
                                    }}
                                    className="block w-full rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                    Porsi Perusahaan Buffer (%)
                                  </label>
                                  <input
                                    type="number"
                                    value={formData.opexBufferCompanyPercent}
                                    readOnly
                                    className="block w-full rounded-xl border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-sm py-3 text-gray-500 dark:text-gray-400"
                                  />
                                </div>
                              </>
                            )}
                            {formData.opexBufferFundingMode === "FIXED" && (
                              <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                  Nominal Fixed Investor
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={formData.opexBufferInvestorFixedAmount}
                                  onChange={(e) =>
                                    setFormData({
                                      ...formData,
                                      opexBufferInvestorFixedAmount: Number(
                                        e.target.value,
                                      ),
                                    })
                                  }
                                  className="block w-full rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white"
                                />
                              </div>
                            )}
                          </div>

                          <div className="mt-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-xs text-amber-700 dark:text-amber-200">
                            {opexBufferPreview.opexBufferDurationLabel}
                          </div>

                          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                            <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3">
                              <div className="text-gray-500">Total Buffer</div>
                              <div className="font-bold text-gray-900 dark:text-white">
                                {formatCurrency(
                                  opexBufferPreview.opexBufferTotal,
                                )}
                              </div>
                            </div>
                            <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3">
                              <div className="text-blue-600 dark:text-blue-300">
                                Porsi Investor
                              </div>
                              <div className="font-bold text-blue-700 dark:text-blue-200">
                                {formatCurrency(
                                  opexBufferPreview.opexBufferInvestorShare,
                                )}
                              </div>
                            </div>
                            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3">
                              <div className="text-emerald-600 dark:text-emerald-300">
                                Porsi Perusahaan
                              </div>
                              <div className="font-bold text-emerald-700 dark:text-emerald-200">
                                {formatCurrency(
                                  opexBufferPreview.opexBufferCompanyShare,
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <p className="mt-3 text-[10px] text-gray-500 italic leading-relaxed">
                          * Modal CAPEX dan porsi Buffer OPEX yang didanai
                          investor menjadi dana yang direcovery. Buffer OPEX
                          tetap dipisahkan dari CAPEX murni agar cashflow
                          ramp-up transparan.
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                          Deskripsi Proyek
                        </label>
                        <textarea
                          value={formData.description}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              description: e.target.value,
                            })
                          }
                          className="block w-full rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:text-white py-3"
                          rows={3}
                          placeholder="Jelaskan cakupan atau tujuan proyek..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Summary & Status */}
                <div className="space-y-5">
                  <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl shadow-blue-500/20 relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
                      <HiOutlineCalculator className="w-32 h-32" />
                    </div>

                    <h4 className="text-xs font-bold uppercase tracking-widest text-blue-100 mb-4">
                      Financial Overview
                    </h4>
                    <div className="space-y-4 relative z-10">
                      <div>
                        <div className="text-[10px] text-blue-100 uppercase font-medium">
                          Total Investasi (CAPEX + Contingency)
                        </div>
                        <div className="text-2xl font-black">
                          {formatCurrency(totalInvestment)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-blue-100 uppercase font-medium">
                          Total Setoran Investor
                        </div>
                        <div className="text-sm font-bold">
                          {formatCurrency(
                            opexBufferPreview.investorDepositTotal,
                          )}
                        </div>
                      </div>
                      {targetBasis === "HOMEPASS" && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <div className="text-[10px] text-blue-100 uppercase font-medium">
                              Biaya / Homepass
                            </div>
                            <div className="text-sm font-bold">
                              {formatCurrency(unitCosts.costPerHomepass)}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-blue-100 uppercase font-medium">
                              Biaya / Homeconnect
                            </div>
                            <div className="text-sm font-bold">
                              {formatCurrency(
                                unitCosts.costPerHomeconnectRevenue,
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-[10px] text-blue-100 uppercase font-medium">
                            OPEX/Bulan
                          </div>
                          <div className="text-sm font-bold">
                            {formatCurrency(totalOpex)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-blue-100 uppercase font-medium">
                            Est. BEP
                          </div>
                          <div className="text-sm font-bold">
                            {realisticBepMonths === Infinity
                              ? "∞"
                              : `${realisticBepMonths} Bln`}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-3">
                      Status Dokumen
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {["DRAFT", "PENDING", "APPROVED"].map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setFormData({ ...formData, status })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            formData.status === status
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                              : "bg-gray-50 text-gray-400 dark:bg-gray-700/50 border border-transparent hover:bg-gray-100"
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setMainTab("growth")}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25 active:scale-95"
                >
                  Selanjutnya: Model Pertumbuhan
                  <HiOutlineArrowTrendingUp className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Periode Pertumbuhan */}
          {mainTab === "growth" && (
            <RABFormGrowthTab
              targetBasis={targetBasis}
              setTargetBasis={setTargetBasis}
              targetHomepass={targetHomepass}
              setTargetHomepass={setTargetHomepass}
              targetTakeUpRatePercent={targetTakeUpRatePercent}
              setTargetTakeUpRatePercent={setTargetTakeUpRatePercent}
              effectiveTargetSubscribers={effectiveTargetSubscribers}
              setTargetSubscribers={setTargetSubscribers}
              arpu={arpu}
              setArpu={setArpu}
              projectedRevenue={projectedRevenue}
              totalCapex={totalCapex}
              unitCosts={unitCosts}
              growthType={growthType}
              setGrowthType={setGrowthType}
              paymentType={paymentType}
              setPaymentType={setPaymentType}
              linearSettings={linearSettings}
              setLinearSettings={setLinearSettings}
              percentageSettings={percentageSettings}
              setPercentageSettings={setPercentageSettings}
              customMilestones={customMilestones}
              handleAddMilestone={handleAddMilestone}
              updateMilestone={updateMilestone}
              handleRemoveMilestone={handleRemoveMilestone}
              previewSubscribers={previewSubscribers}
              realisticBepMonths={realisticBepMonths}
              margin={margin}
              monthsToFullCapacity={monthsToFullCapacity}
              simpleBepMonths={simpleBepMonths}
              onChangeTab={setMainTab}
            />
          )}

          {/* Tab 3: Item & Biaya */}
          {mainTab === "items" && (
            <RABFormItemsTab
              items={items}
              categories={categories}
              wbsGroups={wbsGroups}
              setWbsGroups={setWbsGroups}
              setItems={setItems}
              expenseTab={expenseTab}
              setExpenseTab={setExpenseTab}
              handleAddItem={handleAddItem}
              handleRemoveItem={handleRemoveItem}
              updateItem={updateItem}
              setActiveTerminItemId={setActiveTerminItemId}
              projectedRevenue={projectedRevenue}
              nplTolerancePercent={formData.nplTolerancePercent}
              totalCapex={totalCapex}
              totalOpex={totalOpex}
              totalInvestment={totalInvestment}
              contingencyPercent={formData.contingencyPercent}
              capexItems={capexItems}
              opexItems={opexItems}
              onChangeTab={setMainTab}
            />
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <HiOutlineCheck className="w-5 h-5" />
                Simpan RAB
              </>
            )}
          </button>
        </div>
      </form>

      <ItemDisbursementModal
        isOpen={!!activeTerminItemId}
        onClose={() => setActiveTerminItemId(null)}
        item={items.find((i) => i.id === activeTerminItemId)}
        onUpdate={(newDisbursements) => {
          if (activeTerminItemId) {
            updateItem(activeTerminItemId, "disbursements", newDisbursements);
          }
        }}
      />
    </Modal>
  );
}
