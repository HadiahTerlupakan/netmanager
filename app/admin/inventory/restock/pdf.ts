import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "react-hot-toast";

import type { PurchaseRequest } from "./types";

interface AutoTableDoc extends jsPDF {
  lastAutoTable: {
    finalY: number;
  };
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

  doc.text("Nomor Dokumen:", leftCol, 45);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(request.nomorRequest, leftCol + 35, 45);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Tanggal Pengajuan:", leftCol, 52);
  doc.setTextColor(30, 41, 59);
  doc.text(
    new Date(request.createdAt).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }),
    leftCol + 35,
    52,
  );

  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text("Gudang Tujuan:", leftCol, 59);
  doc.setTextColor(30, 41, 59);
  doc.text(request.gudang?.nama || "-", leftCol + 35, 59);

  doc.text("Status Dokumen:", rightCol, 45);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(79, 70, 229);
  doc.text(request.status, rightCol + 35, 45);

  if (request.approvedAt) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Tanggal Approval:", rightCol, 52);
    doc.setTextColor(30, 41, 59);
    doc.text(
      new Date(request.approvedAt).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }),
      rightCol + 35,
      52,
    );
  }

  autoTable(doc, {
    startY: 70,
    head: [["KODE BARANG", "NAMA BARANG", "JUMLAH", "KETERANGAN"]],
    body: request.items.map((item) => [
      item.barang.kode,
      item.barang.nama,
      `${item.jumlah} ${item.barang.satuan}`,
      "-",
    ]),
    theme: "grid",
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: "bold",
      halign: "center",
    },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: { 2: { halign: "center" } },
  });

  const finalY = (doc as AutoTableDoc).lastAutoTable.finalY + 30;
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

  doc.save(`PO-${request.nomorRequest}.pdf`);
  toast.success("PDF Purchase Order berhasil diunduh");
}
