import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "react-hot-toast";
import {
  PLANNING_STATUS_CONFIG,
  formatDateShort,
} from "@/modules/planning/client";
import type { PlanningDetailDTO } from "@/modules/planning/client";
import type { PlanningStatus } from "@/modules/planning/client";

interface AutoTableDoc extends jsPDF {
  lastAutoTable?: { finalY: number };
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function formatRupiah(value: number | null | undefined): string {
  if (value == null) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

function writeMetaRow(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
) {
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(label, x, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(value, x + 38, y);
}

/**
 * Generate & download PDF dokumen Planning OSP (client-side, jspdf).
 */
export function downloadPlanningPdf(planning: PlanningDetailDTO): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text("PLANNING OSP", pageWidth / 2, 22, { align: "center" });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(20, 28, pageWidth - 20, 28);

  // Metadata
  doc.setFontSize(10);
  const leftCol = 20;
  const rightCol = 120;

  writeMetaRow(doc, "Judul:", planning.title, leftCol, 40);
  writeMetaRow(doc, "Area:", planning.area, leftCol, 47);
  writeMetaRow(doc, "Tipe:", planning.type, leftCol, 54);
  writeMetaRow(
    doc,
    "Status:",
    PLANNING_STATUS_CONFIG[planning.status as PlanningStatus].label,
    leftCol,
    61,
  );

  writeMetaRow(
    doc,
    "Approval Level:",
    planning.approvalLevel === 2 ? "2 Level" : "1 Level",
    rightCol,
    40,
  );
  writeMetaRow(
    doc,
    "Estimasi Unit:",
    `${planning.estimatedUnits} unit`,
    rightCol,
    47,
  );
  writeMetaRow(
    doc,
    "Progress:",
    `${planning.progressPercentage}%`,
    rightCol,
    54,
  );
  writeMetaRow(
    doc,
    "Dibuat:",
    formatDateLong(planning.createdAt),
    rightCol,
    61,
  );

  // Budget summary
  doc.setFont("helvetica", "bold");
  doc.setTextColor(79, 70, 229);
  doc.setFontSize(11);
  doc.text("RINGKASAN BUDGET", 20, 75);

  const budgetY = 82;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.text("Estimasi Budget:", 20, budgetY);
  doc.text(formatRupiah(planning.estimatedBudget), 70, budgetY);
  doc.text("Actual Budget:", 20, budgetY + 7);
  doc.text(formatRupiah(planning.actualBudget), 70, budgetY + 7);
  doc.text("Mulai:", 120, budgetY);
  doc.text(formatDateShort(planning.startDate), 160, budgetY);
  doc.text("Target:", 120, budgetY + 7);
  doc.text(formatDateShort(planning.targetCompletionDate), 160, budgetY + 7);

  if (planning.description) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("Deskripsi:", 20, budgetY + 18);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    doc.text(doc.splitTextToSize(planning.description, 170), 20, budgetY + 24);
  }

  // Material items table
  let nextY = budgetY + 35;

  if (planning.items.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(79, 70, 229);
    doc.setFontSize(11);
    doc.text("MATERIAL ITEMS", 20, nextY);

    autoTable(doc, {
      startY: nextY + 5,
      head: [["NO", "NAMA", "QTY", "SATUAN", "HARGA", "TOTAL"]],
      body: planning.items.map((item, index) => [
        String(index + 1),
        item.name,
        String(item.quantity),
        item.unit,
        formatRupiah(item.estimatedPrice),
        formatRupiah(item.totalEstimated),
      ]),
      theme: "grid",
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: "bold",
        halign: "center",
      },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { halign: "center", cellWidth: 12 },
        2: { halign: "center", cellWidth: 18 },
        4: { halign: "right", cellWidth: 32 },
        5: { halign: "right", cellWidth: 32 },
      },
    });
    nextY = (doc as AutoTableDoc).lastAutoTable?.finalY ?? nextY;
  }

  // Milestones table
  if (planning.milestones.length > 0) {
    nextY += 12;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(79, 70, 229);
    doc.setFontSize(11);
    doc.text("MILESTONES", 20, nextY);

    autoTable(doc, {
      startY: nextY + 5,
      head: [["NO", "NAMA", "TARGET", "AKTUAL", "STATUS"]],
      body: planning.milestones.map((ms, index) => [
        String(index + 1),
        ms.name,
        formatDateShort(ms.targetDate),
        ms.actualDate ? formatDateShort(ms.actualDate) : "-",
        ms.status,
      ]),
      theme: "grid",
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: "bold",
        halign: "center",
      },
      styles: { fontSize: 8, cellPadding: 3 },
    });
    nextY = (doc as AutoTableDoc).lastAutoTable?.finalY ?? nextY;
  }

  // Signature
  const sigY = Math.min(nextY + 30, 270);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);
  doc.text("Dibuat oleh,", 45, sigY, { align: "center" });
  doc.line(20, sigY + 28, 70, sigY + 28);

  doc.text("Disetujui oleh,", pageWidth - 45, sigY, { align: "center" });
  doc.line(pageWidth - 70, sigY + 28, pageWidth - 20, sigY + 28);

  const filename = sanitizeFilename(`Planning-${planning.title}`);
  doc.save(`${filename}.pdf`);
  toast.success("PDF Planning berhasil diunduh");
}

/**
 * Fetch detail planning lalu generate PDF. Dipakai dari detail/list page.
 */
export async function downloadPlanningPdfById(
  planningId: string,
): Promise<void> {
  const res = await fetch(`/api/planning/${planningId}`);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Gagal memuat data planning");
  }
  const planning = (json.data ?? json) as PlanningDetailDTO;
  downloadPlanningPdf(planning);
}
