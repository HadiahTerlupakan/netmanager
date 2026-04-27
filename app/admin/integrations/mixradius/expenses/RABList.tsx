/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineCalculator,
  HiOutlineBuildingOffice,
  HiOutlineArrowTrendingUp,
  HiOutlineUsers,
  HiOutlineEye,
  HiOutlineDocumentArrowDown,
  HiOutlineDocumentText,
  HiOutlineDocumentDuplicate,
} from "react-icons/hi2";
import toast from "react-hot-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ResponsiveTable } from "@/components/ui/ResponsiveTable";
import { calculateRabUnitCosts } from "@/modules/finance/utils/rabTarget";
import { formatCurrency } from "@/lib/utils";
import { usePermission } from "@/hooks/use-permission";
import RABCompare from "./RABCompare";
import { calculateRealisticBEP } from "./rabCalculations";
import { buildRABCsvContent } from "./rab-csv";
import { buildRABPdfTrackingTable, getRABPdfDocumentOptions } from "./rab-pdf";
import type {
  LinearGrowthSettings,
  PercentageGrowthSettings,
  RABProject,
} from "./rabTypes";

function getProfitShareRows(project: RABProject): string[][] {
  if (project.investorProfitShareMode !== "TIERED_AFTER_BEP") {
    const investorShare = project.investorProfitSharePercent || 50;
    return [
      ["Skema Bagi Hasil", "Tetap"],
      ["Bagi Hasil Investor", `${investorShare}%`],
      ["Bagi Hasil Perusahaan", `${100 - investorShare}%`],
    ];
  }

  return [
    ["Skema Bagi Hasil", "Bertahap Setelah Balik Modal"],
    [
      "Investor Sebelum Balik Modal",
      `${project.investorProfitShareBeforeBepPercent || 80}%`,
    ],
    [
      "Investor Setelah Balik Modal",
      `${project.investorProfitShareAfterBepPercent || 60}%`,
    ],
  ];
}

interface RABListProps {
  initialData?: RABProject[];
  onEdit: (project: RABProject) => void;
  onView: (project: RABProject) => void;
  onRevise: (project: RABProject) => void;
  onRefreshRequested?: () => void;
  refreshKey?: number;
}

export default function RABList({
  initialData,
  onEdit,
  onView,
  onRevise,
  onRefreshRequested,
  refreshKey,
}: RABListProps) {
  const { hasPermission } = usePermission();
  const canUpdate =
    hasPermission("mixradius_expenses:update") ||
    hasPermission("expense:update");
  const canDelete =
    hasPermission("mixradius_expenses:delete") ||
    hasPermission("expense:delete");

  const [data, setData] = useState<RABProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | "all">(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [data]);

  const totalPages =
    itemsPerPage === "all" ? 1 : Math.ceil(data.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    if (itemsPerPage === "all") return data;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return data.slice(startIndex, startIndex + itemsPerPage);
  }, [data, currentPage, itemsPerPage]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleCompare = () => {
    if (selectedIds.length < 2) {
      toast.error("Pilih minimal 2 RAB untuk dibandingkan");
      return;
    }
    if (selectedIds.length > 4) {
      toast.error("Maksimal membandingkan 4 RAB agar tampilan tetap nyaman");
      return;
    }
    setShowCompareModal(true);
  };

  const selectedProjects = data.filter((p) => selectedIds.includes(p.id));

  const handleExport = (project: RABProject) => {
    const csvContent = buildRABCsvContent(project);

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `RAB-${project.name.replace(/\s+/g, "-")}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = (project: RABProject) => {
    try {
      const doc = new jsPDF(getRABPdfDocumentOptions());
      const { bepMonth } = calculateRealisticBEP(project);

      // Header
      doc.setFontSize(16);
      doc.text(`Rencana Anggaran Biaya (RAB): ${project.name}`, 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(
        `Dicetak pada: ${new Date().toLocaleDateString("id-ID")}`,
        14,
        28,
      );

      // Project Summary Details
      doc.setTextColor(0);
      doc.text(`Keterangan: ${project.description || "-"}`, 14, 38);
      doc.text(`Status: ${project.status}`, 14, 44);
      doc.text(
        `Site / Group: ${project.mixRadiusGroup?.name || project.site?.name || "-"}`,
        14,
        50,
      );

      // Financial Metrics Title
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(79, 70, 229); // Indigo-600
      doc.text("Ringkasan Finansial", 14, 62);

      // Faint divider line
      doc.setDrawColor(229, 231, 235); // Gray-200
      doc.setLineWidth(0.5);
      doc.line(14, 66, 196, 66);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      const capexItems = project.items.filter(
        (item) => !item.expenseType || item.expenseType === "CAPEX",
      );
      const totalCapex = capexItems.reduce(
        (sum, item) => sum + Number(item.totalPrice),
        0,
      );
      const contingencyAmount = Number(project.contingencyAmount || 0);
      const totalInvestment = totalCapex + contingencyAmount;
      const unitCosts = calculateRabUnitCosts({
        totalCapex,
        targetHomepass: project.targetHomepass,
        targetSubscribers: project.targetSubscribers,
      });

      let growthModelDesc = "-";
      if (project.growthType === "LINEAR") {
        const s = project.growthSettings as LinearGrowthSettings;
        growthModelDesc = `Linear (${s?.subscribersPerMonth || 0} plg/Bulan)`;
      } else if (project.growthType === "PERCENTAGE") {
        const s = project.growthSettings as PercentageGrowthSettings;
        growthModelDesc = `Persentase (Awal: ${s?.initialPercent || 0}%, Naik: ${s?.monthlyGrowthPercent || 0}%/Bulan)`;
      } else if (project.growthType === "CUSTOM") {
        growthModelDesc = "Kustom (Berdasarkan Target Spesifik Bulan)";
      }

      const trackingTable = buildRABPdfTrackingTable(project);

      const metrics = [
        ["Total CAPEX Dasar", formatCurrency(totalCapex)],
        [
          `Contingency (${project.contingencyPercent || 0}%)`,
          formatCurrency(contingencyAmount),
        ],
        ["Total Investasi", formatCurrency(totalInvestment)],
        [
          "Buffer OPEX Investor",
          formatCurrency(trackingTable.totals.opexBufferInvestorShare),
        ],
        [
          "Total Setoran Investor",
          formatCurrency(trackingTable.totals.investorDepositTotal),
        ],
        [
          "Total Dana Direcovery",
          formatCurrency(trackingTable.totals.initialFundingNeed),
        ],
        ["OPEX / Bulan", formatCurrency(Number(project.projectedOpex))],
        [
          "Basis Target",
          project.targetBasis === "HOMEPASS"
            ? "Homepass Dibangun"
            : "Homeconnect",
        ],
        ...(project.targetBasis === "HOMEPASS"
          ? [
              ["Target Homepass", `${project.targetHomepass || 0} Homepass`],
              ["Take-up Rate", `${project.targetTakeUpRatePercent || 0}%`],
              [
                "Target Homeconnect Revenue",
                `${project.targetSubscribers || 0} Pelanggan`,
              ],
              ["Biaya per Homepass", formatCurrency(unitCosts.costPerHomepass)],
              [
                "Biaya per Homeconnect Revenue",
                formatCurrency(unitCosts.costPerHomeconnectRevenue),
              ],
            ]
          : [
              [
                "Target Pelanggan",
                `${project.targetSubscribers || 0} Pelanggan`,
              ],
            ]),
        ["Model Pertumbuhan", growthModelDesc],
        [
          "Sistem Pembayaran",
          project.paymentType === "POSTPAID"
            ? "Pascabayar (Postpaid)"
            : "Prabayar (Prepaid)",
        ],
        ["Toleransi NPL (%)", `${project.nplTolerancePercent || 0}%`],
        [
          "Pengembalian Modal",
          project.investmentRecoveryType === "PERCENTAGE"
            ? `${project.investmentRecoveryValue}% dari Profit/Bulan`
            : `${formatCurrency(project.investmentRecoveryValue || 0)}/Bulan`,
        ],
        ["Durasi Kontrak", `${project.investmentDurationMonths || 12} Bulan`],
        ...getProfitShareRows(project),
        [
          "Estimasi BEP Keseluruhan",
          bepMonth === Infinity ? "Tidak Terhingga" : `${bepMonth} Bulan`,
        ],
      ];

      // AutoTable for metrics
      autoTable(doc, {
        startY: 72,
        body: metrics,
        theme: "grid",
        styles: {
          fontSize: 9,
          cellPadding: 4,
          lineColor: [229, 231, 235], // Gray-200
          lineWidth: 0.1,
        },
        columnStyles: {
          0: {
            fontStyle: "normal",
            cellWidth: 65,
            fillColor: [249, 250, 251], // Gray-50
            textColor: [75, 85, 99], // Gray-600
          },
          1: {
            cellWidth: 117,
            fontStyle: "bold",
            textColor: [17, 24, 39], // Gray-900
          },
        },
        margin: { bottom: 20 },
      });

      // Tracking Pencapaian Table
      const totalRec = trackingTable.totals.recoveryInstallment;
      const totalInv = trackingTable.totals.investorShare;
      const totalComp = trackingTable.totals.companyShare;

      const docAsJspdf = doc as jsPDF & { lastAutoTable?: { finalY: number } };

      let currentY = docAsJspdf.lastAutoTable
        ? docAsJspdf.lastAutoTable.finalY + 12
        : 100;

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(79, 70, 229);
      doc.text("Buffer OPEX Ramp-up", 14, currentY);

      autoTable(doc, {
        startY: currentY + 6,
        body: trackingTable.fundingSummary,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 70, fillColor: [249, 250, 251] },
          1: { cellWidth: 112, halign: "right", fontStyle: "bold" },
        },
        margin: { bottom: 20 },
      });

      currentY = docAsJspdf.lastAutoTable
        ? docAsJspdf.lastAutoTable.finalY + 12
        : currentY + 50;

      // RINGKASAN PEMBAGIAN AKHIR (Boxed Version)
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }

      // Draw a rounded rectangle for the summary card
      const boxWidth = 182;
      const boxHeight = 28;
      doc.setFillColor(249, 250, 251); // Gray-50
      doc.setDrawColor(229, 231, 235); // Gray-200
      doc.setLineWidth(0.1);
      doc.roundedRect(14, currentY, boxWidth, boxHeight, 3, 3, "FD");

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(79, 70, 229); // Indigo-600
      doc.text("RINGKASAN PEMBAGIAN AKHIR:", 20, currentY + 7);

      doc.setFontSize(8);
      doc.setTextColor(75, 85, 99); // Gray-600
      doc.setFont("helvetica", "normal");
      doc.text("Total Hak Investor (Modal + Profit)", 20, currentY + 15);
      doc.text("Total Hak Perusahaan (Profit)", 20, currentY + 22);

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(17, 24, 39); // Gray-900
      doc.text(
        formatCurrency(totalRec + totalInv),
        boxWidth - 10,
        currentY + 15,
        { align: "right" },
      );
      doc.text(formatCurrency(totalComp), boxWidth - 10, currentY + 22, {
        align: "right",
      });

      currentY = currentY + boxHeight + 12;

      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Tracking Pencapaian (Realisasi)", 14, currentY);

      autoTable(doc, {
        startY: currentY + 6,
        head: trackingTable.head,
        body: trackingTable.body,
        foot: trackingTable.foot,
        theme: "striped",
        headStyles: { fillColor: [79, 70, 229], fontStyle: "bold" }, // Indigo-600
        footStyles: {
          fillColor: [243, 244, 246],
          textColor: [0, 0, 0],
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        styles: { fontSize: 7, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 12 },
          1: { halign: "right", cellWidth: 30 },
          2: { halign: "right", cellWidth: 28 },
          3: { halign: "right", cellWidth: 30 },
          4: { halign: "right", cellWidth: 24 },
          5: { halign: "right", cellWidth: 29 },
          6: { halign: "right", cellWidth: 30 },
          7: { halign: "right", cellWidth: 30 },
          8: { halign: "right", cellWidth: 27 },
          9: { halign: "right", cellWidth: 29 },
        },
        showFoot: "lastPage",
        margin: { bottom: 20 },
      });
      let currentTableY =
        (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
          .finalY + 10;

      if (currentTableY > 260) {
        doc.addPage();
        currentTableY = 20;
      }
      // Items Table
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      const itemsY = currentTableY;
      doc.text("Daftar Item & Biaya", 14, itemsY);

      const tableHeaders = [
        ["Nama Item", "Kategori", "Tipe", "Qty", "Harga Satuan", "Total Harga"],
      ];

      // Generate rows with WBS grouping if applicable
      const tableData: any[] = [];
      const hasWbs = project.wbsGroups && project.wbsGroups.length > 0;

      if (!hasWbs) {
        project.items.forEach((item) => {
          tableData.push([
            item.name,
            item.expenseCategory && typeof item.expenseCategory === "object"
              ? item.expenseCategory.parent
                ? `${item.expenseCategory.parent.name} - ${item.expenseCategory.name}`
                : item.expenseCategory.name
              : item.category || "-",
            item.expenseType || "CAPEX",
            item.quantity.toString(),
            formatCurrency(Number(item.unitPrice)),
            formatCurrency(Number(item.totalPrice)),
          ]);
        });
      } else {
        const groups = [...(project.wbsGroups || [])].sort(
          (a, b) => a.order - b.order,
        );
        const ungrouppedItems = project.items.filter(
          (i) => !(i as any).wbsId && !i.wbsGroupId,
        );

        groups.forEach((wbs) => {
          const groupItems = project.items.filter(
            (i) => (i as any).wbsId === wbs.id || i.wbsGroupId === wbs.id,
          );
          if (groupItems.length === 0) return;
          const groupSubtotal = groupItems.reduce(
            (sum, item) => sum + Number(item.totalPrice),
            0,
          );

          tableData.push([
            {
              content: wbs.name.toUpperCase(),
              colSpan: 5,
              styles: { fontStyle: "bold", fillColor: [243, 244, 246] },
            },
            {
              content: formatCurrency(groupSubtotal),
              styles: {
                fontStyle: "bold",
                halign: "right",
                fillColor: [243, 244, 246],
              },
            },
          ]);

          groupItems.forEach((item) => {
            tableData.push([
              `  ${item.name}`, // Indent slightly
              item.expenseCategory && typeof item.expenseCategory === "object"
                ? item.expenseCategory.parent
                  ? `${item.expenseCategory.parent.name} - ${item.expenseCategory.name}`
                  : item.expenseCategory.name
                : item.category || "-",
              item.expenseType || "CAPEX",
              item.quantity.toString(),
              formatCurrency(Number(item.unitPrice)),
              formatCurrency(Number(item.totalPrice)),
            ]);
          });
        });

        if (ungrouppedItems.length > 0) {
          const groupSubtotal = ungrouppedItems.reduce(
            (sum, item) => sum + Number(item.totalPrice),
            0,
          );
          tableData.push([
            {
              content: "LAIN-LAIN (BELUM DIGRUP)",
              colSpan: 5,
              styles: { fontStyle: "bold", fillColor: [243, 244, 246] },
            },
            {
              content: formatCurrency(groupSubtotal),
              styles: {
                fontStyle: "bold",
                halign: "right",
                fillColor: [243, 244, 246],
              },
            },
          ]);
          ungrouppedItems.forEach((item) => {
            tableData.push([
              `  ${item.name}`,
              item.expenseCategory && typeof item.expenseCategory === "object"
                ? item.expenseCategory.parent
                  ? `${item.expenseCategory.parent.name} - ${item.expenseCategory.name}`
                  : item.expenseCategory.name
                : item.category || "-",
              item.expenseType || "CAPEX",
              item.quantity.toString(),
              formatCurrency(Number(item.unitPrice)),
              formatCurrency(Number(item.totalPrice)),
            ]);
          });
        }
      }

      const totalItemsPrice = project.items.reduce(
        (sum, item) => sum + Number(item.totalPrice),
        0,
      );

      autoTable(doc, {
        startY: itemsY + 6,
        head: tableHeaders,
        body: tableData,
        foot: [
          [
            "TOTAL SELURUH ITEM",
            "",
            "",
            "",
            "",
            formatCurrency(totalItemsPrice),
          ],
        ],
        theme: "striped",
        headStyles: { fillColor: [79, 70, 229], fontStyle: "bold" }, // Indigo-600
        footStyles: {
          fillColor: [243, 244, 246],
          textColor: [0, 0, 0],
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        styles: { fontSize: 8, cellPadding: 3 },
        columnStyles: {
          3: { halign: "center" },
          4: { halign: "right" },
          5: { halign: "right", fontStyle: "bold" },
        },
        showFoot: "lastPage",
        margin: { bottom: 20 },
      });

      // Disbursements Table
      const allDisbursements = project.items.reduce((acc, item) => {
        if (item.disbursements && item.disbursements.length > 0) {
          item.disbursements.forEach((d) => {
            acc.push({
              ...d,
              itemName: item.name,
            });
          });
        }
        return acc;
      }, [] as any[]);

      if (allDisbursements.length > 0) {
        // Sort by date chronologically
        allDisbursements.sort((a, b) => {
          if (!a.estimatedDate) return 1;
          if (!b.estimatedDate) return -1;
          return (
            new Date(a.estimatedDate).getTime() -
            new Date(b.estimatedDate).getTime()
          );
        });

        let disbY =
          (doc as unknown as { lastAutoTable: { finalY: number } })
            .lastAutoTable.finalY + 15;
        if (disbY > 250) {
          doc.addPage();
          disbY = 20;
        }

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Jadwal Pencairan (Termin)", 14, disbY);

        const disbHeaders = [
          [
            "No",
            "Item",
            "Keterangan Termin",
            "Estimasi Tanggal",
            "Persentase",
            "Nominal Pencairan",
            "Status",
          ],
        ];
        const disbData = allDisbursements.map((d, i) => [
          (i + 1).toString(),
          d.itemName,
          d.name || `Termin ${i + 1}`,
          d.estimatedDate
            ? new Date(d.estimatedDate).toLocaleDateString("id-ID")
            : "-",
          `${d.percentage}%`,
          formatCurrency(Number(d.amount)),
          d.isPaid ? "Cair" : "Menunggu",
        ]);

        autoTable(doc, {
          startY: disbY + 6,
          head: disbHeaders,
          body: disbData,
          theme: "striped",
          headStyles: { fillColor: [79, 70, 229], fontStyle: "bold" },
          styles: { fontSize: 8, cellPadding: 3 },
          columnStyles: {
            0: { halign: "center", cellWidth: 10 },
            4: { halign: "right" },
            5: { halign: "right", fontStyle: "bold" },
            6: { halign: "center" },
          },
        });
      }

      // Signature Section for APPROVED RABs
      if (
        project.status === "APPROVED" &&
        project.approvals &&
        project.approvals.length >= 2
      ) {
        let sigY =
          (doc as unknown as { lastAutoTable: { finalY: number } })
            .lastAutoTable?.finalY + 15 || currentTableY + 20;

        if (sigY > 240) {
          doc.addPage();
          sigY = 30;
        }

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        doc.text("Mengetahui & Menyetujui,", 14, sigY);

        // Get the first two approvers
        const approver1 = project.approvals[0];
        const approver2 = project.approvals[1];

        const sigYPos = sigY + 10;
        const sigHeight = 25;

        // First Approver (Left)
        doc.setFontSize(9);
        doc.text("Disetujui Oleh:", 20, sigYPos);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(79, 70, 229); // Indigo text for signature proxy
        doc.text("Telah Disetujui Secara Digital", 20, sigYPos + 12);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.text(approver1.user.name || "Unknown", 20, sigYPos + sigHeight);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(approver1.user.role?.name || "-", 20, sigYPos + sigHeight + 5);

        // Second Approver (Right)
        const rightX = 120;
        doc.setFontSize(9);
        doc.text("Disetujui Oleh:", rightX, sigYPos);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(79, 70, 229);
        doc.text("Telah Disetujui Secara Digital", rightX, sigYPos + 12);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.text(approver2.user.name || "Unknown", rightX, sigYPos + sigHeight);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(
          approver2.user.role?.name || "-",
          rightX,
          sigYPos + sigHeight + 5,
        );
      }

      // Save PDF
      doc.save(`RAB-${project.name.replace(/\\s+/g, "-")}.pdf`);
      toast.success("RAB berhasil diekspor ke PDF");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Gagal membuat file PDF");
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const requestUrl = refreshKey
        ? `/api/finance/rab-projects?refreshKey=${refreshKey}`
        : "/api/finance/rab-projects";
      const res = await fetch(requestUrl);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("RAB fetch error:", res.status, errorData);
        throw new Error(
          errorData.error || `Gagal mengambil data RAB (status: ${res.status})`,
        );
      }
      const result = await res.json();
      const rabData = Array.isArray(result) ? result : result.data || [];
      setData(rabData);
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Gagal mengambil data RAB",
      );
    } finally {
      setLoading(false);
    }
  }, [refreshKey]);

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
      return;
    }

    void fetchData();
  }, [fetchData, initialData]);

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah anda yakin ingin menghapus RAB ini?")) return;

    try {
      const res = await fetch(`/api/finance/rab-projects/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal menghapus RAB");
      }
      toast.success("RAB berhasil dihapus");
      if (onRefreshRequested) {
        onRefreshRequested();
      } else {
        void fetchData();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menghapus RAB",
      );
    }
  };

  const handleDuplicate = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menduplikasi RAB ini?")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/finance/rab-projects/${id}/copy`, {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok) {
        toast.success("RAB berhasil diduplikasi");
        if (onRefreshRequested) {
          onRefreshRequested();
        } else {
          void fetchData();
        }
      } else {
        toast.error(json.error || "Gagal menduplikasi RAB");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal terhubung ke server",
      );
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalCapex = (project: RABProject) => {
    return project.items
      .filter((item) => !item.expenseType || item.expenseType === "CAPEX")
      .reduce((sum, item) => sum + Number(item.totalPrice), 0);
  };

  const getGrowthTypeLabel = (type?: string) => {
    switch (type) {
      case "LINEAR":
        return "Linear";
      case "PERCENTAGE":
        return "Persentase";
      case "CUSTOM":
        return "Kustom";
      default:
        return "-";
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

  const getRevisionStatusCopy = (item: RABProject) => {
    if (item.latestRevision?.status === "PENDING_APPROVAL") {
      return "Revisi menunggu approval";
    }

    if (item.latestRevision?.status === "REJECTED") {
      return "Revisi terakhir ditolak";
    }

    if (item.finalApprovedRevisionId) {
      return "Sudah ada baseline final";
    }

    if ((item.revisionCount ?? 0) > 0) {
      return "Ada draft revisi aktif";
    }

    return "Belum ada revisi";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 shadow-sm dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200">
        <div className="font-semibold">Alur revisi RAB (disederhanakan)</div>
        <div>
          Urutan kerja: <span className="font-semibold">Lihat Detail</span>{" "}
          untuk cek kondisi proyek, lanjut{" "}
          <span className="font-semibold">Kelola Revisi</span> untuk ubah draft,
          lalu pantau status approval di detail proyek.
        </div>
      </div>

      {/* Bulk Actions Header */}
      {selectedIds.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 flex items-center justify-between animate-in fade-in slide-in-from-top-4">
          <span className="text-sm font-medium text-indigo-800 dark:text-indigo-300">
            {selectedIds.length} proyek dipilih
          </span>
          <button
            type="button"
            onClick={handleCompare}
            disabled={selectedIds.length < 2}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <HiOutlineDocumentDuplicate className="w-4 h-4" />
            Bandingkan {selectedIds.length > 1 ? `(${selectedIds.length})` : ""}
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <ResponsiveTable
          keyField="id"
          data={paginatedData}
          page={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          itemsPerPageOptions={[10, 20, 50, 100, "all"]}
          onItemsPerPageChange={(val) => {
            setItemsPerPage(val);
            setCurrentPage(1);
          }}
          loading={loading}
          emptyMessage={
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
              <div className="bg-gray-100 dark:bg-gray-700/50 p-4 rounded-full mb-3">
                <HiOutlineCalculator className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-lg font-medium">Belum ada data RAB</p>
              <p className="text-sm mt-1">
                Buat RAB baru untuk memulai perencanaan proyek
              </p>
            </div>
          }
          renderMobileCard={(item) => {
            const { bepMonth } = calculateRealisticBEP(item);
            return (
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm space-y-4">
                {/* Header: Checkbox & Name */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelection(item.id)}
                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-600 dark:bg-gray-700 dark:border-gray-600 dark:ring-offset-gray-800"
                      />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900 dark:text-white leading-tight">
                        {item.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                        {item.description || "Tidak ada deskripsi"}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`inline-flex px-2 py-0.5 ${getStatusBadge(item.status)} rounded text-[10px] font-bold uppercase`}
                  >
                    {item.status || "DRAFT"}
                  </span>
                </div>

                {/* Main Info Grid */}
                <div className="grid grid-cols-2 gap-4 py-3 border-y border-gray-100 dark:border-gray-800">
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
                      Total CAPEX
                    </div>
                    <div className="font-bold text-purple-600 dark:text-purple-400 font-mono text-sm leading-none">
                      {formatCurrency(calculateTotalCapex(item))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
                      Est. BEP
                    </div>
                    <div
                      className={`font-bold px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1 ${
                        bepMonth === Infinity
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          : bepMonth <= 24
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                      }`}
                    >
                      {bepMonth === Infinity ? "∞" : `${bepMonth} Bulan`}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
                      Site / Group
                    </div>
                    <div className="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      <HiOutlineBuildingOffice className="w-3.5 h-3.5 text-gray-400" />
                      {item.mixRadiusGroup?.name || item.site?.name || "-"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
                      Model Growth
                    </div>
                    <div className="text-xs text-purple-700 dark:text-purple-300 flex items-center gap-1">
                      <HiOutlineArrowTrendingUp className="w-3.5 h-3.5 text-purple-400" />
                      {getGrowthTypeLabel(item.growthType)}
                    </div>
                  </div>
                </div>

                {/* Actions Section */}
                <div className="space-y-3">
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => onView(item)}
                      className="w-full flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200"
                    >
                      <HiOutlineEye className="w-4 h-4" />
                      Lihat Detail
                    </button>
                    {canUpdate && (
                      <button
                        type="button"
                        onClick={() => onRevise(item)}
                        className="w-full flex items-center justify-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-200"
                      >
                        <HiOutlineDocumentText className="w-4 h-4" />
                        {item.latestRevision?.status === "PENDING_APPROVAL"
                          ? "Revisi Pending"
                          : "Kelola Revisi"}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      {canUpdate && (
                        <>
                          <button
                            onClick={() => onEdit(item)}
                            className="p-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                          >
                            <HiOutlinePencilSquare className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDuplicate(item.id)}
                            className="p-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg"
                          >
                            <HiOutlineDocumentDuplicate className="w-5 h-5" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleExport(item)}
                        className="p-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg"
                      >
                        <HiOutlineDocumentArrowDown className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleExportPDF(item)}
                        className="p-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg"
                      >
                        <HiOutlineDocumentText className="w-5 h-5" />
                      </button>
                    </div>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg"
                      >
                        <HiOutlineTrash className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          }}
          columns={[
            {
              key: "select",
              header: "",
              priority: "primary",
              render: (item) => (
                <div className="flex justify-center -ml-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleSelection(item.id)}
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-600 dark:bg-gray-700 dark:border-gray-600 dark:ring-offset-gray-800"
                  />
                </div>
              ),
            },
            {
              key: "name",
              header: "Nama Proyek",
              priority: "primary",
              render: (item) => (
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {item.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                    {item.description}
                  </div>
                </div>
              ),
            },
            {
              key: "site",
              header: "Site / Group",
              priority: "secondary",
              render: (item) => {
                const name = item.mixRadiusGroup?.name || item.site?.name;
                return name ? (
                  <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                    <HiOutlineBuildingOffice className="w-4 h-4 text-gray-400" />
                    {name}
                  </div>
                ) : (
                  <span className="text-gray-400 italic text-sm">-</span>
                );
              },
            },
            {
              key: "target",
              header: "Target",
              priority: "secondary",
              render: (item) => (
                <div className="flex items-center gap-1.5 text-sm">
                  <HiOutlineUsers className="w-4 h-4 text-indigo-400" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {item.targetSubscribers || "-"}
                  </span>
                </div>
              ),
            },
            {
              key: "growthType",
              header: "Model Growth",
              priority: "secondary",
              render: (item) => (
                <div className="flex items-center gap-1.5">
                  <HiOutlineArrowTrendingUp className="w-4 h-4 text-purple-400" />
                  <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-0.5 rounded">
                    {getGrowthTypeLabel(item.growthType)}
                  </span>
                </div>
              ),
            },
            {
              key: "totalCapex",
              header: "Total CAPEX",
              priority: "primary",
              render: (item) => (
                <span className="font-bold text-purple-600 dark:text-purple-400 font-mono">
                  {formatCurrency(calculateTotalCapex(item))}
                </span>
              ),
            },
            {
              key: "bep",
              header: "Est. BEP",
              priority: "secondary",
              render: (item) => {
                const { bepMonth, simpleBep } = calculateRealisticBEP(item);
                const hasGrowth =
                  item.targetSubscribers && item.arpu && item.growthSettings;

                return (
                  <div className="space-y-1">
                    <div
                      className={`font-bold px-2 py-1 rounded-md text-xs inline-flex items-center gap-1 ${
                        bepMonth === Infinity
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          : bepMonth <= 24
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                      }`}
                    >
                      {bepMonth === Infinity ? "∞" : `${bepMonth} Bulan`}
                      {hasGrowth && (
                        <HiOutlineArrowTrendingUp className="w-3 h-3" />
                      )}
                    </div>
                    {hasGrowth && simpleBep !== Infinity && (
                      <div className="text-[10px] text-gray-400">
                        Sederhana: {simpleBep.toFixed(1)} bln
                      </div>
                    )}
                  </div>
                );
              },
            },
            {
              key: "status",
              header: "Status",
              priority: "primary",
              render: (item) => (
                <div className="space-y-1">
                  <span
                    className={`inline-flex px-2 py-1 ${getStatusBadge(item.status)} rounded text-xs font-bold uppercase`}
                  >
                    {item.status || "DRAFT"}
                  </span>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {getRevisionStatusCopy(item)}
                  </div>
                </div>
              ),
            },
            {
              key: "actions",
              header: "Aksi",
              priority: "primary",
              render: (item: RABProject) => (
                <div className="flex flex-wrap md:justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => onView(item)}
                    className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200 dark:hover:bg-indigo-900/50"
                    title="Lihat Detail & Status Revisi"
                    aria-label={`Lihat detail ${item.name}`}
                  >
                    <HiOutlineEye className="w-4 h-4" />
                    <span>Lihat Detail</span>
                  </button>
                  {canUpdate && (
                    <>
                      <button
                        type="button"
                        onClick={() => onRevise(item)}
                        className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-200 dark:hover:bg-sky-900/50"
                        title="Kelola Revisi RAB"
                        aria-label={`Kelola revisi RAB untuk ${item.name}`}
                      >
                        <HiOutlineDocumentText className="w-4 h-4" />
                        <span>
                          {item.latestRevision?.status === "PENDING_APPROVAL"
                            ? "Lihat Revisi Pending"
                            : "Kelola Revisi"}
                        </span>
                      </button>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEdit(item)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
                          title="Edit"
                          aria-label={`Edit ${item.name}`}
                        >
                          <HiOutlinePencilSquare className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicate(item.id)}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors border border-transparent hover:border-amber-200 dark:hover:border-amber-800"
                          title="Duplikat (Copy)"
                          aria-label={`Duplikat ${item.name}`}
                        >
                          <HiOutlineDocumentDuplicate className="w-5 h-5" />
                        </button>
                      </div>
                    </>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleExport(item)}
                      className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors border border-transparent hover:border-green-200 dark:hover:border-green-800"
                      title="Export CSV"
                      aria-label={`Export CSV ${item.name}`}
                    >
                      <HiOutlineDocumentArrowDown className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportPDF(item)}
                      className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-800"
                      title="Export PDF"
                      aria-label={`Export PDF ${item.name}`}
                    >
                      <HiOutlineDocumentText className="w-5 h-5" />
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors border border-transparent hover:border-red-200 dark:hover:border-red-800"
                        title="Hapus"
                        aria-label={`Hapus ${item.name}`}
                      >
                        <HiOutlineTrash className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              ),
            },
          ]}
        />

        {showCompareModal && (
          <RABCompare
            projects={selectedProjects}
            isOpen={showCompareModal}
            onClose={() => setShowCompareModal(false)}
          />
        )}
      </div>
    </div>
  );
}
