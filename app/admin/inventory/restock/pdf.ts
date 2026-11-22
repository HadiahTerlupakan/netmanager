import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "react-hot-toast";

import {
  type ApprovalLine,
  getRequestedQuantity,
  getRequestedSatuan,
  isLineRejected,
  wasSubstituted,
} from "./approvalUtils";
import { getRestockStatus } from "./restockStatus";
import type { PurchaseRequest } from "./types";

interface AutoTableDoc extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

const REJECTED_LABEL = "Ditolak";
const UNDECIDED_REQUEST_STATUSES = new Set(["DRAFT", "SUBMITTED"]);

type LineApprovalState = "AWAITING" | "REJECTED" | "APPROVED";

interface PurchaseRequestTableItem {
  kode: string;
  nama: string;
  requestedQuantity: string;
  keterangan: string;
}

const DEFAULT_TABLE_FINAL_Y = 100;

function sanitizePdfFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function formatPurchaseRequestDate(value: string): string {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

interface PurchaseRequestJasaTableItem {
  kode: string;
  nama: string;
  requestedQuantity: string;
  statusKonfirmasi: string;
  keterangan: string;
}

/**
 * Gabungkan keterangan pemohon dan catatan atasan dalam satu sel. Baris
 * barang yang ditolak diawali "Ditolak" karena tabelnya tidak punya kolom
 * keputusan.
 */
function formatLineNotes(
  keterangan: string | null | undefined,
  catatanApproval: string | null | undefined,
  isRejected = false,
): string {
  const notes = [
    isRejected ? REJECTED_LABEL : null,
    keterangan,
    catatanApproval ? `Catatan atasan: ${catatanApproval}` : null,
  ].filter(Boolean);
  return notes.length > 0 ? notes.join("\n") : "-";
}

/**
 * Keadaan keputusan satu baris di dokumen. PR yang belum diputuskan belum
 * punya jumlah disetujui; PR yang ditolak utuh berarti semua barisnya ditolak,
 * termasuk baris lama yang statusApproval-nya masih PENDING.
 */
function getLineApprovalState(
  requestStatus: string,
  line: ApprovalLine,
): LineApprovalState {
  if (requestStatus === "REJECTED" || isLineRejected(line)) return "REJECTED";
  if (UNDECIDED_REQUEST_STATUSES.has(requestStatus)) return "AWAITING";
  return "APPROVED";
}

interface PrintableLines {
  barangItems: PurchaseRequest["items"];
  jasaItems: NonNullable<PurchaseRequest["jasaItems"]>;
}

/**
 * Baris yang dicetak di dokumen. Baris yang ditolak dibuang supaya penerima
 * barang tidak mengira barang itu masih harus diurus. Bila semua
 * baris ditolak (atau pengajuan ditolak utuh), semuanya tetap dicetak dengan
 * tanda "Ditolak" agar dokumen tidak kosong dan alasan penolakannya terbaca.
 */
function selectPrintableLines(request: PurchaseRequest): PrintableLines {
  const barangItems = request.items ?? [];
  const jasaItems = request.jasaItems ?? [];
  const isKept = (line: ApprovalLine) =>
    getLineApprovalState(request.status, line) !== "REJECTED";
  const keptBarang = barangItems.filter(isKept);
  const keptJasa = jasaItems.filter(isKept);
  if (keptBarang.length === 0 && keptJasa.length === 0) {
    return { barangItems, jasaItems };
  }
  return { barangItems: keptBarang, jasaItems: keptJasa };
}

function getJasaStatusLabel(
  item: NonNullable<PurchaseRequest["jasaItems"]>[number],
  state: LineApprovalState,
): string {
  if (state === "REJECTED") return REJECTED_LABEL;
  return item.statusKonfirmasi === "SELESAI"
    ? "Selesai"
    : "Menunggu Konfirmasi";
}

function getPurchaseRequestJasaTableItem(
  item: NonNullable<PurchaseRequest["jasaItems"]>[number],
  requestStatus: string,
): PurchaseRequestJasaTableItem {
  const satuan = item.jasa?.satuan || "job";
  const state = getLineApprovalState(requestStatus, item);
  return {
    kode: item.jasa?.kode || "-",
    nama: item.jasa?.nama || "Jasa tidak tersedia",
    requestedQuantity: `${getRequestedQuantity(item)} ${satuan}`,
    statusKonfirmasi: getJasaStatusLabel(item, state),
    keterangan: formatLineNotes(item.keterangan, item.catatanApproval),
  };
}

function getBarangDisplayName(item: PurchaseRequest["items"][number]): string {
  const nama = item.barang?.nama || "Barang tidak tersedia";
  if (!wasSubstituted(item)) return nama;
  return `${nama} (pengganti ${item.barangDiminta?.nama ?? "barang lain"})`;
}

function getPurchaseRequestTableItem(
  item: PurchaseRequest["items"][number],
  request: PurchaseRequest,
): PurchaseRequestTableItem {
  const isRejected = getLineApprovalState(request.status, item) === "REJECTED";

  return {
    kode: item.barang?.kode || "-",
    nama: getBarangDisplayName(item),
    requestedQuantity: `${getRequestedQuantity(item)} ${getRequestedSatuan(item)}`,
    keterangan: formatLineNotes(
      item.keterangan,
      item.catatanApproval,
      isRejected,
    ),
  };
}

function writeMetadataRow(
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
  doc.text(value, x + 35, y);
}

function writeNoteBlock(doc: jsPDF, label: string, value: string, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text(label, 20, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);
  doc.text(doc.splitTextToSize(value, 170), 20, y + 6);
}

/**
 * Generate & download PDF dokumen Purchase Request (bukan Purchase Order).
 * PO yang terkait (jika ada) ditampilkan sebagai referensi meta saja.
 */
export function generatePurchaseRequestPdf(request: PurchaseRequest) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59);
  doc.text("PENGAJUAN BARANG", pageWidth / 2, 25, { align: "center" });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(20, 32, pageWidth - 20, 32);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);

  const leftCol = 20;
  const rightCol = 130;

  writeMetadataRow(doc, "Nomor Pengajuan:", request.nomorRequest, leftCol, 45);
  writeMetadataRow(
    doc,
    "Tanggal Pengajuan:",
    formatPurchaseRequestDate(request.tanggal || request.createdAt),
    leftCol,
    52,
  );
  writeMetadataRow(
    doc,
    "Gudang Tujuan:",
    request.gudang?.nama || "-",
    leftCol,
    59,
  );
  writeMetadataRow(doc, "Prioritas:", request.prioritas || "-", leftCol, 66);
  writeMetadataRow(
    doc,
    "Status:",
    getRestockStatus(request).label,
    leftCol,
    73,
  );
  writeMetadataRow(
    doc,
    "Kode Pesanan:",
    request.purchaseOrder?.poNumber || "-",
    rightCol,
    45,
  );

  if (request.approvedAt) {
    writeMetadataRow(
      doc,
      "Tanggal Disetujui:",
      formatPurchaseRequestDate(request.approvedAt),
      rightCol,
      52,
    );
  }

  if (request.keterangan) {
    writeNoteBlock(doc, "Catatan Pengajuan:", request.keterangan, 78);
  }

  if (request.catatanApproval) {
    writeNoteBlock(doc, "Catatan Atasan:", request.catatanApproval, 91);
  }

  const { barangItems, jasaItems } = selectPrintableLines(request);

  let nextTableY = DEFAULT_TABLE_FINAL_Y;

  if (barangItems.length > 0) {
    autoTable(doc, {
      startY: nextTableY,
      head: [["KODE", "NAMA BARANG", "DIMINTA", "KETERANGAN"]],
      body: barangItems.map((item) => {
        const tableItem = getPurchaseRequestTableItem(item, request);
        return [
          tableItem.kode,
          tableItem.nama,
          tableItem.requestedQuantity,
          tableItem.keterangan,
        ];
      }),
      theme: "grid",
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: "bold",
        halign: "center",
      },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        2: { halign: "center" },
      },
    });
    nextTableY = (doc as AutoTableDoc).lastAutoTable?.finalY ?? nextTableY;
  }

  if (jasaItems.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(109, 40, 217);
    doc.text("ITEM JASA", 20, nextTableY + 12);

    autoTable(doc, {
      startY: nextTableY + 17,
      head: [["KODE", "NAMA JASA", "DIMINTA", "STATUS", "KETERANGAN"]],
      body: jasaItems.map((item) => {
        const tableItem = getPurchaseRequestJasaTableItem(item, request.status);
        return [
          tableItem.kode,
          tableItem.nama,
          tableItem.requestedQuantity,
          tableItem.statusKonfirmasi,
          tableItem.keterangan,
        ];
      }),
      theme: "grid",
      headStyles: {
        fillColor: [109, 40, 217],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: "bold",
        halign: "center",
      },
      styles: { fontSize: 9, cellPadding: 4 },
      columnStyles: {
        2: { halign: "center" },
        3: { halign: "center" },
      },
    });
    nextTableY = (doc as AutoTableDoc).lastAutoTable?.finalY ?? nextTableY;
  }

  const finalY = nextTableY + 30;
  if (finalY > 250) doc.addPage();
  const signatureY = finalY > 250 ? 40 : finalY;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);
  doc.text("Dibuat oleh (Pemohon),", 40, signatureY, { align: "center" });
  doc.setFont("courier", "italic");
  doc.setTextColor(150, 150, 150);
  doc.text("[ Tanda tangan digital ]", 40, signatureY + 15, {
    align: "center",
  });
  doc.setFont("helvetica", "bold");
  doc.text(request.requester?.name || "-", 40, signatureY + 30, {
    align: "center",
  });
  doc.line(20, signatureY + 32, 60, signatureY + 32);

  if (request.approver) {
    doc.setFont("helvetica", "normal");
    doc.text("Disetujui oleh,", pageWidth - 40, signatureY, {
      align: "center",
    });
    doc.setFont("courier", "italic");
    doc.setTextColor(79, 70, 229);
    doc.text("[ Disetujui lewat aplikasi ]", pageWidth - 40, signatureY + 15, {
      align: "center",
    });
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text(request.approver.name, pageWidth - 40, signatureY + 30, {
      align: "center",
    });
    doc.line(pageWidth - 60, signatureY + 32, pageWidth - 20, signatureY + 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`ID: ${request.id.slice(0, 8)}`, pageWidth - 40, signatureY + 36, {
      align: "center",
    });
  }

  const filename = sanitizePdfFilename(`PR-${request.nomorRequest}`);
  doc.save(`${filename}.pdf`);
  toast.success("PDF pengajuan sudah diunduh.");
}
