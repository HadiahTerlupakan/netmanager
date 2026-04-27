/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import { formatCurrency } from "@/lib/utils";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/Modal";
import {
  HiOutlineDocumentText,
  HiOutlineCube,
  HiOutlineCalculator,
  HiOutlineBuildingOffice,
  HiOutlineArrowTrendingUp,
  HiOutlineCalendar,
  HiOutlineUsers,
  HiOutlineCheck,
  HiOutlineBanknotes,
} from "react-icons/hi2";
import { useSession } from "next-auth/react";
import { calculateRabUnitCosts } from "@/modules/finance/client";
import { calculateRealisticBEP } from "./rabCalculations";
import { buildRABTrackingDataset } from "./rabTracking";
import {
  formatRabGrowthTypeLabel,
  formatRabProfitShareDescription,
} from "./rab-formatters";
import type { RABProject } from "./rabTypes";
import RABRevisionSummaryCards from "./RABRevisionSummaryCards";
import RABRevisionTimeline from "./RABRevisionTimeline";
import RABTrackingSection from "./RABTrackingSection";
import RABVarianceTable from "./RABVarianceTable";

import type {
  RABRevisionProfitLossSummary,
  RABRevisionRecord,
} from "./rabRevisionTypes";

interface RABViewProps {
  isOpen: boolean;
  data: RABProject | null;
  onRefresh?: () => void;
  onOpenRevision?: (project: RABProject) => void;
  onClose: () => void;
}

export default function RABView({
  isOpen,
  data,
  onRefresh,
  onOpenRevision,
  onClose,
}: RABViewProps) {
  const { data: session } = useSession();
  const currentUser = session?.user;
  const [actuals, setActuals] = useState<RABProject["actualAchievements"]>([]);
  const [editingMonth, setEditingMonth] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    actualSubscribers: 0,
    actualRevenue: "",
    manualRecoveryInstallment: "",
    manualInvestorShare: "",
    manualCompanyShare: "",
    manualInvestorProfitSharePercent: "",
  });
  const [isSavingActual, setIsSavingActual] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [revisions, setRevisions] = useState<RABRevisionRecord[]>([]);
  const [revisionSummary, setRevisionSummary] =
    useState<RABRevisionProfitLossSummary | null>(null);
  const [isLoadingRevisionAnalytics, setIsLoadingRevisionAnalytics] =
    useState(false);
  const [isSubmittingRevisionId, setIsSubmittingRevisionId] = useState<
    string | null
  >(null);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectingRevision, setRejectingRevision] =
    useState<RABRevisionRecord | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  useEffect(() => {
    if (data) {
      setActuals(data.actualAchievements || []);
    }
  }, [data]);

  const loadRevisionAnalytics = useCallback(async (projectId: string) => {
    setIsLoadingRevisionAnalytics(true);

    try {
      const [revisionResponse, summaryResponse] = await Promise.all([
        fetch(`/api/finance/rab-projects/${projectId}/revisions`),
        fetch(`/api/finance/rab-projects/${projectId}/revision-profit-loss`),
      ]);

      const revisionBody = await revisionResponse.json();
      const summaryBody = await summaryResponse.json();

      if (!revisionResponse.ok) {
        throw new Error(revisionBody.error || "Gagal memuat histori revisi");
      }

      if (!summaryResponse.ok) {
        throw new Error(summaryBody.error || "Gagal memuat ringkasan revisi");
      }

      setRevisions(revisionBody.data || []);
      setRevisionSummary(summaryBody.data || null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memuat data revisi RAB",
      );
    } finally {
      setIsLoadingRevisionAnalytics(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !data?.id) {
      return;
    }

    void loadRevisionAnalytics(data.id);
  }, [data?.id, isOpen, loadRevisionAnalytics]);

  const handleApproveRevision = async (revision: RABRevisionRecord) => {
    if (!data) {
      return;
    }

    setIsSubmittingRevisionId(revision.id);

    try {
      const response = await fetch(
        `/api/integrations/mixradius/expenses/rab/${data.id}/revisions/${revision.id}/approve`,
        { method: "POST" },
      );
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || "Gagal menyetujui revisi");
      }

      toast.success(body.message || "Revisi berhasil disetujui");
      await loadRevisionAnalytics(data.id);
      onRefresh?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menyetujui revisi",
      );
    } finally {
      setIsSubmittingRevisionId(null);
    }
  };

  const handleRejectRevision = (revision: RABRevisionRecord) => {
    setRejectingRevision(revision);
    setRejectNotes("");
    setIsRejectModalOpen(true);
  };

  const handleConfirmRejectRevision = async () => {
    if (!data || !rejectingRevision) {
      return;
    }

    setIsSubmittingRevisionId(rejectingRevision.id);

    try {
      const response = await fetch(
        `/api/integrations/mixradius/expenses/rab/${data.id}/revisions/${rejectingRevision.id}/reject`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ notes: rejectNotes.trim() }),
        },
      );
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || "Gagal menolak revisi");
      }

      toast.success(body.message || "Revisi berhasil ditolak");
      setIsRejectModalOpen(false);
      setRejectingRevision(null);
      setRejectNotes("");
      await loadRevisionAnalytics(data.id);
      onRefresh?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menolak revisi",
      );
    } finally {
      setIsSubmittingRevisionId(null);
    }
  };

  if (!data) return null;

  const requiredApprovals = 2;
  const approvalCount = data.approvals?.length ?? 0;
  const canManage =
    (currentUser as any)?.isSuperAdmin || (currentUser as any)?.canApproveRab;
  const hasReachedApprovalTarget = approvalCount >= requiredApprovals;

  const capexItems = data.items.filter(
    (i) => !i.expenseType || i.expenseType === "CAPEX",
  );

  const totalCapex = capexItems.reduce(
    (sum, item) => sum + Number(item.totalPrice),
    0,
  );
  const contingencyAmount = Number(data.contingencyAmount || 0);
  const contingencyPercent = data.contingencyPercent || 0;
  const totalInvestment = totalCapex + contingencyAmount;
  const totalOpex = Number(data.projectedOpex || 0);
  const unitCosts = calculateRabUnitCosts({
    totalCapex,
    targetHomepass: data.targetHomepass,
    targetSubscribers: data.targetSubscribers,
  });

  const projectedRevenue = Number(data.projectedRevenue || 0);
  const { bepMonth, simpleBep, monthsToFullCapacity, roiPerYear } =
    calculateRealisticBEP(data);

  const startYear = data.startDate
    ? new Date(data.startDate).getFullYear()
    : new Date().getFullYear();
  const trackingDataset = buildRABTrackingDataset(data, actuals || []);
  const trackingRows = trackingDataset.rows;
  const trackingTotals = trackingDataset.totals;

  const handleEditClick = (
    monthIndex: number,
    defaultSubs: number,
    defaultRev: number,
  ) => {
    const existing = actuals.find((a) => a.month === monthIndex);
    setEditingMonth(monthIndex);
    setEditForm({
      actualSubscribers: existing
        ? Number(existing.actualSubscribers)
        : defaultSubs,
      actualRevenue: existing
        ? String(existing.actualRevenue)
        : String(defaultRev),
      manualRecoveryInstallment: existing?.manualRecoveryInstallment
        ? String(existing.manualRecoveryInstallment)
        : "",
      manualInvestorShare: existing?.manualInvestorShare
        ? String(existing.manualInvestorShare)
        : "",
      manualCompanyShare: existing?.manualCompanyShare
        ? String(existing.manualCompanyShare)
        : "",
      manualInvestorProfitSharePercent:
        existing?.manualInvestorProfitSharePercent
          ? String(existing.manualInvestorProfitSharePercent)
          : "",
    });
  };

  const handleSaveActual = async (monthIndex: number) => {
    setIsSavingActual(true);
    try {
      const res = await fetch(`/api/finance/rab-projects/${data.id}/actuals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month: monthIndex,
          year: startYear + Math.floor((monthIndex - 1) / 12),
          actualSubscribers: editForm.actualSubscribers,
          actualRevenue: editForm.actualRevenue.replace(/[^0-9]/g, ""),
          manualRecoveryInstallment:
            editForm.manualRecoveryInstallment.replace(/[^0-9]/g, "") || null,
          manualInvestorShare:
            editForm.manualInvestorShare.replace(/[^0-9]/g, "") || null,
          manualCompanyShare:
            editForm.manualCompanyShare.replace(/[^0-9]/g, "") || null,
          manualInvestorProfitSharePercent:
            editForm.manualInvestorProfitSharePercent
              ? parseFloat(editForm.manualInvestorProfitSharePercent)
              : null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setActuals((prev) => {
          const filtered = prev.filter((a) => a.month !== monthIndex);
          return [...filtered, json.data].sort((a, b) => a.month - b.month);
        });
        setEditingMonth(null);
        toast.success("Pencapaian aktual berhasil disimpan!");
      } else {
        toast.error(json.error || "Gagal menyimpan data");
      }
    } catch (_error) {
      toast.error("Gagal terhubung ke server");
    } finally {
      setIsSavingActual(false);
    }
  };

  const handleStatusTransition = async (newStatus: string) => {
    setIsApproving(true);
    try {
      const res = await fetch(`/api/finance/rab-projects/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Status berhasil diubah ke ${newStatus}`);
        // Update local data optimistically
        Object.assign(data, { status: newStatus });
      } else {
        toast.error(json.error || "Gagal mengubah status");
      }
    } catch (_error) {
      toast.error("Gagal terhubung ke server");
    } finally {
      setIsApproving(false);
    }
  };

  const handleSendReminder = async () => {
    setIsSendingReminder(true);
    try {
      const res = await fetch(
        `/api/integrations/mixradius/expenses/rab/${data.id}/reminder`,
        { method: "POST" },
      );
      const json = await res.json();

      if (res.ok) {
        toast.success(json.message || "Reminder berhasil dikirim");
      } else {
        toast.error(json.error || "Gagal mengirim reminder");
      }
    } catch (_error) {
      toast.error("Gagal menghubungi server");
    } finally {
      setIsSendingReminder(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
      case "PENDING_APPROVAL":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case "APPROVED":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "REJECTED":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      case "PENGADAAN":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "PENGGELARAN_JARINGAN":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
      case "PENJUALAN":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400";
      case "TARGET_TERCAPAI":
        return "bg-emerald-500 text-white font-bold";
      case "SELESAI":
        return "bg-gray-800 text-white dark:bg-white dark:text-gray-900 font-bold";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const renderActionButtons = () => {
    if (!canManage) return null;

    switch (data.status) {
      case "DRAFT":
      case "PENDING_APPROVAL":
        return (
          !data.approvals?.some((a) => a.userId === currentUser.id) && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  setIsApproving(true);
                  try {
                    const res = await fetch(
                      `/api/integrations/mixradius/expenses/rab/${data.id}/approve`,
                      { method: "POST" },
                    );
                    const json = await res.json();
                    if (res.ok) {
                      toast.success(json.message);
                      if (json.data) Object.assign(data, json.data);
                    } else {
                      toast.error(json.error || "Gagal menyetujui RAB");
                    }
                  } catch (_e) {
                    toast.error("Gagal menghubungi server");
                  } finally {
                    setIsApproving(false);
                  }
                }}
                disabled={isApproving || isSendingReminder}
                className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isApproving ? (
                  "Memproses..."
                ) : (
                  <>
                    <HiOutlineCheck className="w-4 h-4" />
                    Setujui RAB
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleSendReminder}
                disabled={isApproving || isSendingReminder}
                className="px-3 py-1.5 text-xs font-bold border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors disabled:opacity-50"
              >
                {isSendingReminder ? "Mengirim..." : "Kirim Reminder"}
              </button>
            </div>
          )
        );
      case "APPROVED":
        return (
          <button
            type="button"
            onClick={() => handleStatusTransition("PENGADAAN")}
            disabled={isApproving}
            className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <HiOutlineCalculator className="w-4 h-4" />
            Mulai Pengadaan
          </button>
        );
      case "PENGADAAN":
        return (
          <button
            type="button"
            onClick={() => handleStatusTransition("PENGGELARAN_JARINGAN")}
            disabled={isApproving}
            className="px-3 py-1.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <HiOutlineCube className="w-4 h-4" />
            Mulai Penggelaran
          </button>
        );
      case "PENGGELARAN_JARINGAN":
        return (
          <button
            type="button"
            onClick={() => handleStatusTransition("PENJUALAN")}
            disabled={isApproving}
            className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <HiOutlineUsers className="w-4 h-4" />
            Mulai Penjualan
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Detail RAB Proyek"
        size="4xl"
      >
        <div className="space-y-6">
          {/* Header Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <HiOutlineDocumentText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                    Identitas Proyek
                  </h3>
                </div>

                {/* ACTION BUTTONS */}
                {renderActionButtons()}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1">
                    Nama Proyek
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {data.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1">
                    Status
                  </p>
                  <span
                    className={`px-2 py-1 ${getStatusBadge(data.status)} rounded text-xs font-bold uppercase`}
                  >
                    {data.status || "DRAFT"}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1 flex items-center gap-1">
                    <HiOutlineBuildingOffice className="w-4 h-4" /> Site / Group
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {data.mixRadiusGroup?.name || data.site?.name || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1 flex items-center gap-1">
                    <HiOutlineCalendar className="w-4 h-4" /> Tanggal Mulai
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {data.startDate
                      ? new Date(data.startDate).toLocaleDateString("id-ID")
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1">
                    Durasi Kontrak (Bulan)
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {data.investmentDurationMonths || 12}
                  </p>
                </div>

                <div className="col-span-2 pt-4 border-t border-gray-100 dark:border-gray-700 mt-2">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <HiOutlineBanknotes className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Investor & Profit Sharing
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-gray-500 font-semibold mb-0.5">
                        Komitmen Pengembalian Modal
                      </p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {data.investmentRecoveryType === "PERCENTAGE"
                          ? "Persentase dari Profit"
                          : "Nilai Tetap per Bulan"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 font-semibold mb-0.5">
                        {data.investmentRecoveryType === "PERCENTAGE"
                          ? "Persen Pengembalian dari Profit (%)"
                          : "Nilai Pengembalian per Bulan (IDR)"}
                      </p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {data.investmentRecoveryType === "PERCENTAGE"
                          ? `${data.investmentRecoveryValue}%`
                          : formatCurrency(data.investmentRecoveryValue || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 font-semibold mb-0.5">
                        Toleransi NPL (%)
                      </p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {data.nplTolerancePercent || 0}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 font-semibold mb-0.5">
                        Skema Bagi Hasil
                      </p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {data.investorProfitShareMode === "TIERED_AFTER_BEP"
                          ? "Bertahap Setelah Balik Modal"
                          : "Tetap"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 font-semibold mb-0.5">
                        Porsi Investor / Perusahaan
                      </p>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {formatRabProfitShareDescription(data)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-[10px] text-gray-500 italic leading-relaxed">
                    * Modal CAPEX dan porsi Buffer OPEX yang didanai investor
                    menjadi basis recovery. Buffer OPEX tetap dipisahkan dari
                    CAPEX murni agar kebutuhan cashflow ramp-up transparan.
                  </p>
                </div>

                <div className="col-span-2 pt-2">
                  <p className="text-xs text-gray-500 font-semibold mb-1">
                    Deskripsi Proyek
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700 min-h-[60px]">
                    {data.description || "-"}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-5 text-white shadow-lg relative overflow-hidden">
                <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
                  <HiOutlineCalculator className="w-24 h-24" />
                </div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-blue-100 mb-4">
                  Financial Overview
                </h4>
                <div className="space-y-3 relative z-10">
                  <div>
                    <div className="text-[10px] text-blue-100 uppercase font-medium">
                      Total Investasi (CAPEX + Contg.)
                    </div>
                    <div className="text-xl font-black">
                      {formatCurrency(totalInvestment)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                    <div>
                      <div className="text-[10px] text-blue-100 uppercase font-medium">
                        CAPEX Dasar
                      </div>
                      <div className="text-sm font-bold">
                        {formatCurrency(totalCapex)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-blue-100 uppercase font-medium">
                        Contingency ({contingencyPercent}%)
                      </div>
                      <div className="text-sm font-bold">
                        {formatCurrency(contingencyAmount)}
                      </div>
                    </div>
                    {data.targetBasis === "HOMEPASS" && (
                      <>
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
                      </>
                    )}
                    <div>
                      <div className="text-[10px] text-blue-100 uppercase font-medium">
                        OPEX/Bln
                      </div>
                      <div className="text-sm font-bold">
                        {formatCurrency(totalOpex)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-blue-100 uppercase font-medium">
                        Buffer OPEX Investor
                      </div>
                      <div className="text-sm font-bold">
                        {formatCurrency(trackingTotals.opexBufferInvestorShare)}
                      </div>
                      <div className="mt-1 text-[10px] text-blue-100 leading-snug">
                        {trackingTotals.opexBufferDurationLabel}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-blue-100 uppercase font-medium">
                        Total Setoran Investor
                      </div>
                      <div className="text-sm font-bold">
                        {formatCurrency(trackingTotals.investorDepositTotal)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-blue-100 uppercase font-medium">
                        Dana Direcovery
                      </div>
                      <div className="text-sm font-bold">
                        {formatCurrency(trackingTotals.initialFundingNeed)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-blue-100 uppercase font-medium">
                        ROI (Saat Penuh)
                      </div>
                      <div className="text-sm font-bold">
                        {roiPerYear.toFixed(1)}% / Tahun
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-blue-100 uppercase font-medium">
                        Est. BEP Keseluruhan
                      </div>
                      <div className="text-sm font-bold">
                        {bepMonth === Infinity ? "∞" : `${bepMonth} Bln`}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-blue-100 uppercase font-medium">
                        BEP Pasca Target
                      </div>
                      <div
                        className="text-sm font-bold"
                        title={`Terhitung setelah kapasitas penuh di bulan ke-${monthsToFullCapacity}`}
                      >
                        {simpleBep === Infinity
                          ? "∞"
                          : `${simpleBep.toFixed(1)} Bln`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-md">
                    <HiOutlineArrowTrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h4 className="text-xs font-bold uppercase text-gray-700 dark:text-gray-300">
                    Model Growth
                  </h4>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700 pb-2">
                    <span className="text-gray-500">Tipe Pertumbuhan</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {formatRabGrowthTypeLabel(data.growthType)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700 pb-2">
                    <span className="text-gray-500">Sistem Pembayaran</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {data.paymentType === "POSTPAID"
                        ? "Pascabayar (Postpaid)"
                        : "Prabayar (Prepaid)"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700 pb-2">
                    <span className="text-gray-500">Basis Target</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      {data.targetBasis === "HOMEPASS"
                        ? "Homepass Dibangun"
                        : "Homeconnect"}
                    </span>
                  </div>
                  {data.targetBasis === "HOMEPASS" && (
                    <>
                      <div className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700 pb-2">
                        <span className="text-gray-500">Target Homepass</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {data.targetHomepass || 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700 pb-2">
                        <span className="text-gray-500">Take-up Rate</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {data.targetTakeUpRatePercent || 0}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700 pb-2">
                        <span className="text-gray-500">
                          Biaya per Homepass
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(unitCosts.costPerHomepass)}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700 pb-2">
                    <span className="text-gray-500">
                      {data.targetBasis === "HOMEPASS"
                        ? "Target Homeconnect Revenue"
                        : "Target Pelanggan"}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100 inline-flex items-center gap-1">
                      <HiOutlineUsers className="w-3.5 h-3.5" />{" "}
                      {data.targetSubscribers || 0}
                    </span>
                  </div>
                  {data.targetBasis === "HOMEPASS" && (
                    <div className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700 pb-2">
                      <span className="text-gray-500">
                        Biaya per Homeconnect Revenue
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(unitCosts.costPerHomeconnectRevenue)}
                      </span>
                    </div>
                  )}
                  {data.growthType === "LINEAR" && (
                    <div className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700 pb-2">
                      <span className="text-gray-500">Target Bulanan</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100 text-right">
                        +
                        {(data.growthSettings as any)?.subscribersPerMonth || 0}{" "}
                        <span className="text-xs font-normal text-gray-500">
                          Pelanggan/Bulan
                        </span>
                      </span>
                    </div>
                  )}
                  {data.growthType === "PERCENTAGE" && (
                    <div className="flex justify-between items-start text-sm border-b border-gray-100 dark:border-gray-700 pb-2">
                      <span className="text-gray-500">Target Bulanan</span>
                      <div className="font-semibold text-gray-900 dark:text-gray-100 flex flex-col items-end">
                        <span>
                          Awal:{" "}
                          {(data.growthSettings as any)?.initialPercent || 0}%
                        </span>
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">
                          Naik{" "}
                          {(data.growthSettings as any)?.monthlyGrowthPercent ||
                            0}
                          % / Bulan
                        </span>
                      </div>
                    </div>
                  )}
                  {data.growthType === "CUSTOM" && (
                    <div className="flex justify-between items-center text-sm border-b border-gray-100 dark:border-gray-700 pb-2">
                      <span className="text-gray-500">Target Kustom</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100 text-right text-xs">
                        Berdasarkan target spesifik tiap bulan
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-sm pb-1">
                    <span className="text-gray-500">Max. Revenue / Bln</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">
                      {formatCurrency(projectedRevenue)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
                  Revisi RAB
                </p>
                <h3 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white">
                  Ringkasan Dampak Revisi
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Fokuskan review pada 3 hal: status revisi terbaru, dampak
                  biaya final terhadap realisasi, dan keputusan approval.
                </p>
              </div>

              {onOpenRevision && (
                <button
                  type="button"
                  onClick={() => onOpenRevision(data)}
                  className="inline-flex items-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-900/30 dark:text-sky-200 dark:hover:bg-sky-900/50"
                >
                  Buka Form Revisi
                </button>
              )}
            </div>

            {isLoadingRevisionAnalytics ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-300">
                Memuat analitik revisi...
              </div>
            ) : (
              <>
                {revisionSummary?.finalRevisionSummary ? (
                  <RABRevisionSummaryCards
                    summary={{
                      original: revisionSummary.originalSummary.total,
                      final: revisionSummary.finalRevisionSummary.total,
                      actual: revisionSummary.actualSummary.total,
                      variance: revisionSummary.varianceSummary.netVariance,
                      label: revisionSummary.varianceSummary.netLabel,
                      unmappedRealization: revisionSummary.unmappedRealization,
                    }}
                  />
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-300">
                    Belum ada revisi final yang disetujui. Buka form revisi,
                    ajukan approval, lalu setujui agar baseline final bisa
                    dipakai untuk analisa dampak.
                  </div>
                )}

                <div className="grid gap-4 xl:grid-cols-[1.05fr,1.4fr]">
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Timeline Revisi
                    </h4>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      Histori status draf, pengajuan, approval, dan penetapan
                      baseline final.
                    </p>
                    <div className="mt-4">
                      <RABRevisionTimeline
                        revisions={revisions}
                        finalApprovedRevisionId={
                          revisionSummary?.finalRevisionSummary?.id ??
                          data.finalApprovedRevisionId
                        }
                        canReview={canManage}
                        isSubmittingRevisionId={isSubmittingRevisionId}
                        onApprove={handleApproveRevision}
                        onReject={handleRejectRevision}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Variance per Item
                    </h4>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      Bandingkan budget final yang disetujui dengan realisasi
                      aktual di level item.
                    </p>
                    <div className="mt-4">
                      {revisionSummary?.finalRevisionSummary ? (
                        <RABVarianceTable
                          items={revisionSummary.itemVariances}
                        />
                      ) : (
                        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/30 dark:text-gray-300">
                          Variance per item akan tampil setelah ada revisi yang
                          sudah disetujui sebagai baseline final.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Tracking Pencapaian */}
          <RABTrackingSection
            rows={trackingRows}
            totals={trackingTotals}
            editingMonth={editingMonth}
            editForm={editForm}
            isSavingActual={isSavingActual}
            nplTolerancePercent={data.nplTolerancePercent || 0}
            onEditFormChange={setEditForm}
            onStartEdit={handleEditClick}
            onCancelEdit={() => setEditingMonth(null)}
            onSaveEdit={handleSaveActual}
          />

          {/* Items Lists */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                  <HiOutlineCube className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                  Item & Biaya
                </h3>
              </div>
            </div>

            <div className="p-0">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800/50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Tipe
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Nama Item
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Kategori
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Qty
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Harga Satuan
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {data.items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-8 text-center text-sm text-gray-500"
                        >
                          Tidak ada item pada RAB ini.
                        </td>
                      </tr>
                    ) : (
                      <>
                        {(() => {
                          const hasWbs =
                            data.wbsGroups && data.wbsGroups.length > 0;
                          if (!hasWbs) {
                            return data.items.map((item) => (
                              <React.Fragment key={item.id}>
                                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                  <td className="px-6 py-3 whitespace-nowrap text-sm">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        !item.expenseType ||
                                        item.expenseType === "CAPEX"
                                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                          : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                      }`}
                                    >
                                      {item.expenseType || "CAPEX"}
                                    </span>
                                  </td>
                                  <td className="px-6 py-3 text-sm text-gray-900 dark:text-white font-medium">
                                    {item.name}
                                  </td>
                                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                    {(() => {
                                      const cat = (item as any).expenseCategory;
                                      if (!cat) return item.category || "-";
                                      return cat.parent
                                        ? `${cat.parent.name} - ${cat.name}`
                                        : cat.name;
                                    })()}
                                  </td>
                                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right font-medium">
                                    {item.quantity}
                                  </td>
                                  <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-right">
                                    {formatCurrency(Number(item.unitPrice))}
                                  </td>
                                  <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white text-right">
                                    {formatCurrency(Number(item.totalPrice))}
                                  </td>
                                </tr>
                                {item.disbursements &&
                                  item.disbursements.length > 0 && (
                                    <tr className="bg-indigo-50/30 dark:bg-indigo-900/10">
                                      <td colSpan={6} className="px-6 py-3">
                                        <div className="pl-6 border-l-2 border-indigo-300 dark:border-indigo-700">
                                          <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2">
                                            Termin Pencairan Vendor
                                          </p>
                                          <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-indigo-100 dark:divide-indigo-900/30">
                                              <thead>
                                                <tr>
                                                  <th className="py-2 text-left text-[9px] font-bold text-indigo-400 uppercase">
                                                    Keterangan
                                                  </th>
                                                  <th className="py-2 text-left text-[9px] font-bold text-indigo-400 uppercase">
                                                    Est. Tanggal
                                                  </th>
                                                  <th className="py-2 text-right text-[9px] font-bold text-indigo-400 uppercase">
                                                    Persentase
                                                  </th>
                                                  <th className="py-2 text-right text-[9px] font-bold text-indigo-400 uppercase">
                                                    Nominal
                                                  </th>
                                                  <th className="py-2 text-center text-[9px] font-bold text-indigo-400 uppercase">
                                                    Status
                                                  </th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-indigo-50 dark:divide-indigo-900/20">
                                                {item.disbursements.map(
                                                  (d: any, idx: number) => (
                                                    <tr key={d.id}>
                                                      <td className="py-1.5 text-xs text-indigo-900 dark:text-indigo-300 font-medium">
                                                        {d.name ||
                                                          `Termin ${idx + 1}`}
                                                      </td>
                                                      <td className="py-1.5 text-xs text-indigo-500">
                                                        {d.estimatedDate
                                                          ? new Date(
                                                              d.estimatedDate,
                                                            ).toLocaleDateString(
                                                              "id-ID",
                                                            )
                                                          : "-"}
                                                      </td>
                                                      <td className="py-1.5 text-xs text-indigo-900 dark:text-indigo-300 text-right font-bold">
                                                        {d.percentage}%
                                                      </td>
                                                      <td className="py-1.5 text-xs text-indigo-700 dark:text-indigo-400 text-right font-mono font-medium">
                                                        {formatCurrency(
                                                          Number(d.amount),
                                                        )}
                                                      </td>
                                                      <td className="py-1.5 text-center">
                                                        <span
                                                          className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${d.isPaid ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"}`}
                                                        >
                                                          {d.isPaid
                                                            ? "Cair"
                                                            : "Menunggu"}
                                                        </span>
                                                      </td>
                                                    </tr>
                                                  ),
                                                )}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                              </React.Fragment>
                            ));
                          }

                          // Grouping by WBS
                          const groups = [...(data.wbsGroups || [])].sort(
                            (a, b: any) => a.order - b.order,
                          );
                          const ungrouppedItems = data.items.filter(
                            (i) => !(i as any).wbsId && !i.wbsGroupId,
                          );

                          return (
                            <React.Fragment>
                              {groups.map((wbs) => {
                                const groupItems = data.items.filter(
                                  (i) =>
                                    (i as any).wbsId === wbs.id ||
                                    i.wbsGroupId === wbs.id,
                                );
                                if (groupItems.length === 0) return null;

                                const groupSubtotal = groupItems.reduce(
                                  (sum, item) => sum + Number(item.totalPrice),
                                  0,
                                );
                                return (
                                  <React.Fragment key={wbs.id}>
                                    <tr className="bg-gray-50/80 dark:bg-gray-900/40">
                                      <td
                                        colSpan={5}
                                        className="px-6 py-3 text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider border-l-4 border-indigo-500"
                                      >
                                        {wbs.name}
                                      </td>
                                      <td className="px-6 py-3 text-right text-sm font-black text-indigo-700 dark:text-indigo-400">
                                        {formatCurrency(groupSubtotal)}
                                      </td>
                                    </tr>
                                    {groupItems.map((item) => (
                                      <React.Fragment key={item.id}>
                                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                          <td className="px-6 py-2.5 whitespace-nowrap text-sm">
                                            <span
                                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                !item.expenseType ||
                                                item.expenseType === "CAPEX"
                                                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                                  : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                              }`}
                                            >
                                              {item.expenseType || "CAPEX"}
                                            </span>
                                          </td>
                                          <td className="px-6 py-2.5 text-sm text-gray-900 dark:text-white font-medium pl-8">
                                            {item.name}
                                          </td>
                                          <td className="px-6 py-2.5 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {(() => {
                                              const cat = (item as any)
                                                .expenseCategory;
                                              if (!cat)
                                                return item.category || "-";
                                              return cat.parent
                                                ? `${cat.parent.name} - ${cat.name}`
                                                : cat.name;
                                            })()}
                                          </td>
                                          <td className="px-6 py-2.5 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right font-medium">
                                            {item.quantity}
                                          </td>
                                          <td className="px-6 py-2.5 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-right">
                                            {formatCurrency(
                                              Number(item.unitPrice),
                                            )}
                                          </td>
                                          <td className="px-6 py-2.5 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white text-right">
                                            {formatCurrency(
                                              Number(item.totalPrice),
                                            )}
                                          </td>
                                        </tr>
                                        {item.disbursements &&
                                          item.disbursements.length > 0 && (
                                            <tr className="bg-indigo-50/30 dark:bg-indigo-900/10">
                                              <td
                                                colSpan={6}
                                                className="px-6 py-2"
                                              >
                                                <div className="pl-12 border-l-2 border-indigo-300 dark:border-indigo-700">
                                                  <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2">
                                                    Termin Pencairan Vendor
                                                  </p>
                                                  <div className="overflow-x-auto">
                                                    <table className="min-w-full divide-y divide-indigo-100 dark:divide-indigo-900/30">
                                                      <thead>
                                                        <tr>
                                                          <th className="py-1 text-left text-[9px] font-bold text-indigo-400 uppercase">
                                                            Keterangan
                                                          </th>
                                                          <th className="py-1 text-left text-[9px] font-bold text-indigo-400 uppercase">
                                                            Est. Tanggal
                                                          </th>
                                                          <th className="py-1 text-right text-[9px] font-bold text-indigo-400 uppercase">
                                                            Persentase
                                                          </th>
                                                          <th className="py-1 text-right text-[9px] font-bold text-indigo-400 uppercase">
                                                            Nominal
                                                          </th>
                                                          <th className="py-1 text-center text-[9px] font-bold text-indigo-400 uppercase">
                                                            Status
                                                          </th>
                                                        </tr>
                                                      </thead>
                                                      <tbody className="divide-y divide-indigo-50 dark:divide-indigo-900/20">
                                                        {item.disbursements.map(
                                                          (
                                                            d: any,
                                                            idx: number,
                                                          ) => (
                                                            <tr key={d.id}>
                                                              <td className="py-1 text-[11px] text-indigo-900 dark:text-indigo-300 font-medium">
                                                                {d.name ||
                                                                  `Termin ${idx + 1}`}
                                                              </td>
                                                              <td className="py-1 text-[11px] text-indigo-500">
                                                                {d.estimatedDate
                                                                  ? new Date(
                                                                      d.estimatedDate,
                                                                    ).toLocaleDateString(
                                                                      "id-ID",
                                                                    )
                                                                  : "-"}
                                                              </td>
                                                              <td className="py-1 text-[11px] text-indigo-900 dark:text-indigo-300 text-right font-bold">
                                                                {d.percentage}%
                                                              </td>
                                                              <td className="py-1 text-[11px] text-indigo-700 dark:text-indigo-400 text-right font-mono font-medium">
                                                                {formatCurrency(
                                                                  Number(
                                                                    d.amount,
                                                                  ),
                                                                )}
                                                              </td>
                                                              <td className="py-1 text-center">
                                                                <span
                                                                  className={`inline-flex px-1 py-0.5 rounded text-[8px] font-bold uppercase ${d.isPaid ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"}`}
                                                                >
                                                                  {d.isPaid
                                                                    ? "Cair"
                                                                    : "Menunggu"}
                                                                </span>
                                                              </td>
                                                            </tr>
                                                          ),
                                                        )}
                                                      </tbody>
                                                    </table>
                                                  </div>
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                      </React.Fragment>
                                    ))}
                                  </React.Fragment>
                                );
                              })}
                              {ungrouppedItems.length > 0 && (
                                <React.Fragment>
                                  <tr className="bg-gray-50/80 dark:bg-gray-900/40">
                                    <td
                                      colSpan={5}
                                      className="px-6 py-3 text-xs font-black text-gray-700 dark:text-gray-300 uppercase tracking-wider border-l-4 border-gray-400"
                                    >
                                      Lain-lain (Belum Digrup)
                                    </td>
                                    <td className="px-6 py-3 text-right text-sm font-black text-gray-700 dark:text-gray-400">
                                      {formatCurrency(
                                        ungrouppedItems.reduce(
                                          (sum, item) =>
                                            sum + Number(item.totalPrice),
                                          0,
                                        ),
                                      )}
                                    </td>
                                  </tr>
                                  {ungrouppedItems.map((item) => (
                                    <React.Fragment key={item.id}>
                                      <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                        <td className="px-6 py-2.5 whitespace-nowrap text-sm">
                                          <span
                                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                              !item.expenseType ||
                                              item.expenseType === "CAPEX"
                                                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                                : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                            }`}
                                          >
                                            {item.expenseType || "CAPEX"}
                                          </span>
                                        </td>
                                        <td className="px-6 py-2.5 text-sm text-gray-900 dark:text-white font-medium pl-8">
                                          {item.name}
                                        </td>
                                        <td className="px-6 py-2.5 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                          {(() => {
                                            const cat = (item as any)
                                              .expenseCategory;
                                            if (!cat)
                                              return item.category || "-";
                                            return cat.parent
                                              ? `${cat.parent.name} - ${cat.name}`
                                              : cat.name;
                                          })()}
                                        </td>
                                        <td className="px-6 py-2.5 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right font-medium">
                                          {item.quantity}
                                        </td>
                                        <td className="px-6 py-2.5 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-right">
                                          {formatCurrency(
                                            Number(item.unitPrice),
                                          )}
                                        </td>
                                        <td className="px-6 py-2.5 whitespace-nowrap text-sm font-bold text-gray-900 dark:text-white text-right">
                                          {formatCurrency(
                                            Number(item.totalPrice),
                                          )}
                                        </td>
                                      </tr>
                                      {item.disbursements &&
                                        item.disbursements.length > 0 && (
                                          <tr className="bg-indigo-50/30 dark:bg-indigo-900/10">
                                            <td
                                              colSpan={6}
                                              className="px-6 py-2"
                                            >
                                              <div className="pl-12 border-l-2 border-indigo-300 dark:border-indigo-700">
                                                <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-2">
                                                  Termin Pencairan Vendor
                                                </p>
                                                <div className="overflow-x-auto">
                                                  <table className="min-w-full divide-y divide-indigo-100 dark:divide-indigo-900/30">
                                                    <thead>
                                                      <tr>
                                                        <th className="py-1 text-left text-[9px] font-bold text-indigo-400 uppercase">
                                                          Keterangan
                                                        </th>
                                                        <th className="py-1 text-left text-[9px] font-bold text-indigo-400 uppercase">
                                                          Est. Tanggal
                                                        </th>
                                                        <th className="py-1 text-right text-[9px] font-bold text-indigo-400 uppercase">
                                                          Persentase
                                                        </th>
                                                        <th className="py-1 text-right text-[9px] font-bold text-indigo-400 uppercase">
                                                          Nominal
                                                        </th>
                                                        <th className="py-1 text-center text-[9px] font-bold text-indigo-400 uppercase">
                                                          Status
                                                        </th>
                                                      </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-indigo-50 dark:divide-indigo-900/20">
                                                      {item.disbursements.map(
                                                        (
                                                          d: any,
                                                          idx: number,
                                                        ) => (
                                                          <tr key={d.id}>
                                                            <td className="py-1 text-[11px] text-indigo-900 dark:text-indigo-300 font-medium">
                                                              {d.name ||
                                                                `Termin ${idx + 1}`}
                                                            </td>
                                                            <td className="py-1 text-[11px] text-indigo-500">
                                                              {d.estimatedDate
                                                                ? new Date(
                                                                    d.estimatedDate,
                                                                  ).toLocaleDateString(
                                                                    "id-ID",
                                                                  )
                                                                : "-"}
                                                            </td>
                                                            <td className="py-1 text-[11px] text-indigo-900 dark:text-indigo-300 text-right font-bold">
                                                              {d.percentage}%
                                                            </td>
                                                            <td className="py-1 text-[11px] text-indigo-700 dark:text-indigo-400 text-right font-mono font-medium">
                                                              {formatCurrency(
                                                                Number(
                                                                  d.amount,
                                                                ),
                                                              )}
                                                            </td>
                                                            <td className="py-1 text-center">
                                                              <span
                                                                className={`inline-flex px-1 py-0.5 rounded text-[8px] font-bold uppercase ${d.isPaid ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500"}`}
                                                              >
                                                                {d.isPaid
                                                                  ? "Cair"
                                                                  : "Menunggu"}
                                                              </span>
                                                            </td>
                                                          </tr>
                                                        ),
                                                      )}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                    </React.Fragment>
                                  ))}
                                </React.Fragment>
                              )}
                            </React.Fragment>
                          );
                        })()}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* APPROVER LIST SECTION */}
          {data.approvals && data.approvals.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-indigo-200 dark:border-indigo-900/50 shadow-sm overflow-hidden mt-6">
              <div className="p-4 border-b border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-900/20 flex items-center gap-2">
                <HiOutlineCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 p-0.5" />
                <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">
                  Status Persetujuan
                </h3>
              </div>
              <div className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex gap-4">
                  {data.approvals.map((approval) => (
                    <div
                      key={approval.id}
                      className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-200 dark:border-gray-700 min-w-[200px]"
                    >
                      <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold uppercase shrink-0">
                        {approval.user.name?.charAt(0) || "U"}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {approval.user.name}
                        </p>
                        <p className="text-[10px] text-gray-500 font-medium uppercase">
                          {approval.user.role?.name || "Authorized"}
                        </p>
                        <p className="text-[9px] text-emerald-600 mt-0.5">
                          Disetujui pada{" "}
                          {new Date(approval.createdAt).toLocaleDateString(
                            "id-ID",
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-right space-y-1">
                  {data.status === "APPROVED" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full text-xs font-bold uppercase">
                      <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></div>
                      RAB Telah Disahkan
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 rounded-full text-xs font-bold uppercase">
                      Menunggu Persetujuan
                    </span>
                  )}
                  <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                    {approvalCount}/{requiredApprovals} approver
                    {hasReachedApprovalTarget
                      ? " terpenuhi"
                      : " sudah menyetujui"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-medium rounded-xl transition-colors"
          >
            Tutup
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => {
          setIsRejectModalOpen(false);
          setRejectingRevision(null);
          setRejectNotes("");
        }}
        title="Tolak Revisi"
        description={
          rejectingRevision
            ? `Revisi ${rejectingRevision.revisionNumber}`
            : undefined
        }
        size="lg"
      >
        <ModalBody>
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Tambahkan catatan agar pembuat revisi tahu apa yang harus
              diperbaiki sebelum mengajukan ulang.
            </p>
            <textarea
              value={rejectNotes}
              onChange={(event) => setRejectNotes(event.target.value)}
              placeholder="Contoh: harga satuan item backbone belum pakai penawaran vendor terbaru"
              className="min-h-[120px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </ModalBody>
        <ModalFooter className="justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Catatan penolakan bersifat opsional, namun disarankan diisi.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsRejectModalOpen(false);
                setRejectingRevision(null);
                setRejectNotes("");
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              disabled={Boolean(isSubmittingRevisionId)}
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirmRejectRevision}
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50"
              disabled={Boolean(isSubmittingRevisionId)}
            >
              {isSubmittingRevisionId ? "Memproses..." : "Tolak Revisi"}
            </button>
          </div>
        </ModalFooter>
      </Modal>
    </>
  );
}
