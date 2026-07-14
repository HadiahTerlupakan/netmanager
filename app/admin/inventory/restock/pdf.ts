import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "react-hot-toast";

import type { PurchaseRequest } from "./types";

interface AutoTableDoc extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

interface PurchaseOrderTableItem {
  kode: string;
  nama: string;
  requestedQuantity: string;
  receivedQuantity: string;
  keterangan: string;
}

const DEFAULT_TABLE_FINAL_Y = 100;

function sanitizePdfFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function formatPurchaseOrderDate(value: string): string {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

interface PurchaseOrderJasaTableItem {
  kode: string;
  nama: string;
  requestedQuantity: string;
  statusKonfirmasi: string;
  keterangan: string;
}

function getPurchaseOrderJasaTableItem(
  item: NonNullable<PurchaseRequest["jasaItems"]>[number],
): PurchaseOrderJasaTableItem {
  return {
    kode: item.jasa?.kode || "-",
    nama: item.jasa?.nama || "Jasa tidak tersedia",
    requestedQuantity: `${item.jumlah} ${item.jasa?.satuan || "job"}`,
    statusKonfirmasi:
      item.statusKonfirmasi === "SELESAI" ? "Selesai" : "Menunggu Konfirmasi",
    keterangan: item.keterangan || "-",
  };
}

function getPurchaseOrderTableItem(
  item: PurchaseRequest["items"][number],
): PurchaseOrderTableItem {
  const satuan = item.barang?.satuan || "-";

  return {
    kode: item.barang?.kode || "-",
    nama: item.barang?.nama || "Barang tidak tersedia",
    requestedQuantity: `${item.jumlah} ${satuan}`,
    receivedQuantity: `${item.receivedQuantity || 0} ${satuan}`,
    keterangan: item.keterangan || "-",
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

export function generatePurchaseOrderPdf(request: PurchaseRequest) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(30, 41, 59);
  doc.text("PURCHASE ORDER", pageWidth / 2, 25, { align: "center" });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(20, 32, pageWidth - 20, 32);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);

  const leftCol = 20;
  const rightCol = 130;

  writeMetadataRow(doc, "Nomor Dokumen:", request.nomorRequest, leftCol, 45);
  writeMetadataRow(
    doc,
    "Tanggal Pengajuan:",
    formatPurchaseOrderDate(request.tanggal || request.createdAt),
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
  writeMetadataRow(doc, "Status Dokumen:", request.status, rightCol, 45);
  writeMetadataRow(
    doc,
    "Nomor PO:",
    request.purchaseOrder?.poNumber || "-",
    rightCol,
    52,
  );
  writeMetadataRow(
    doc,
    "Status PO:",
    request.purchaseOrder?.status || "-",
    rightCol,
    59,
  );

  if (request.approvedAt) {
    writeMetadataRow(
      doc,
      "Tanggal Approval:",
      formatPurchaseOrderDate(request.approvedAt),
      rightCol,
      66,
    );
  }

  if (request.keterangan) {
    writeNoteBlock(doc, "Catatan Pengajuan:", request.keterangan, 78);
  }

  if (request.catatanApproval) {
    writeNoteBlock(doc, "Catatan Approval:", request.catatanApproval, 91);
  }

  autoTable(doc, {
    startY: DEFAULT_TABLE_FINAL_Y,
    head: [["KODE", "NAMA BARANG", "DIMINTA", "DITERIMA", "KETERANGAN"]],
    body: request.items.map((item) => {
      const tableItem = getPurchaseOrderTableItem(item);
      return [
        tableItem.kode,
        tableItem.nama,
        tableItem.requestedQuantity,
        tableItem.receivedQuantity,
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
    columnStyles: { 2: { halign: "center" }, 3: { halign: "center" } },
  });

  const jasaItems = request.jasaItems ?? [];
  if (jasaItems.length > 0) {
    const barangTableFinalY =
      (doc as AutoTableDoc).lastAutoTable?.finalY ?? DEFAULT_TABLE_FINAL_Y;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(109, 40, 217);
    doc.text("ITEM JASA", 20, barangTableFinalY + 12);

    autoTable(doc, {
      startY: barangTableFinalY + 17,
      head: [["KODE", "NAMA JASA", "JUMLAH", "STATUS", "KETERANGAN"]],
      body: jasaItems.map((item) => {
        const tableItem = getPurchaseOrderJasaTableItem(item);
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
      columnStyles: { 2: { halign: "center" }, 3: { halign: "center" } },
    });
  }

  const tableFinalY =
    (doc as AutoTableDoc).lastAutoTable?.finalY ?? DEFAULT_TABLE_FINAL_Y;
  const finalY = tableFinalY + 30;
  if (finalY > 250) doc.addPage();
  const signatureY = finalY > 250 ? 40 : finalY;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);
  doc.text("Dibuat oleh (Pemohon),", 40, signatureY, { align: "center" });
  doc.setFont("courier", "italic");
  doc.setTextColor(150, 150, 150);
  doc.text("[ Digital Signature ]", 40, signatureY + 15, { align: "center" });
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
    doc.text("[ Verified Digitally ]", pageWidth - 40, signatureY + 15, {
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

  const filename = sanitizePdfFilename(`PO-${request.nomorRequest}`);
  doc.save(`${filename}.pdf`);
  toast.success("PDF Purchase Order berhasil diunduh");
}
