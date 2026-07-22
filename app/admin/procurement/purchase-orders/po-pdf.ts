import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "react-hot-toast";

interface AutoTableDoc extends jsPDF {
  lastAutoTable?: {
    finalY: number;
  };
}

export interface PurchaseOrderPdfItem {
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  barang: { id: string; nama: string; kode?: string | null } | null;
}

export interface PurchaseOrderPdfJasaItem {
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  jasa: { id: string; kode: string; nama: string; satuan: string };
}

export interface PurchaseOrderPdfData {
  poNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  ppnAmount: number;
  ppnRate: number;
  grandTotal: number;
  expectedDate: string | null;
  notes: string | null;
  fakturPajakNo: string | null;
  fakturPajakDate: string | null;
  vendorNpwp: string | null;
  createdAt: string;
  supplier: { id: string; name: string; npwp: string | null } | null;
  items: PurchaseOrderPdfItem[];
  jasaItems?: PurchaseOrderPdfJasaItem[];
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  ORDERED: "Dipesan",
  RECEIVED: "Diterima",
  CANCELLED: "Dibatalkan",
};

const PAYMENT_LABEL: Record<string, string> = {
  UNPAID: "Belum Bayar",
  PARTIAL: "Sebagian",
  PAID: "Lunas",
};

const DEFAULT_TABLE_Y = 88;

function sanitizePdfFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
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
  doc.text(value, x + 38, y);
}

/**
 * Generate & download PDF dokumen Purchase Order (client-side, jspdf).
 */
export function downloadPurchaseOrderPdf(po: PurchaseOrderPdfData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(30, 41, 59);
  doc.text("PURCHASE ORDER", pageWidth / 2, 22, { align: "center" });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(20, 28, pageWidth - 20, 28);

  doc.setFontSize(10);
  const leftCol = 20;
  const rightCol = 120;

  writeMetadataRow(doc, "No. PO:", po.poNumber, leftCol, 40);
  writeMetadataRow(doc, "Tanggal:", formatDate(po.createdAt), leftCol, 47);
  writeMetadataRow(doc, "Supplier:", po.supplier?.name || "-", leftCol, 54);
  writeMetadataRow(
    doc,
    "NPWP:",
    po.vendorNpwp || po.supplier?.npwp || "-",
    leftCol,
    61,
  );

  writeMetadataRow(
    doc,
    "Status:",
    STATUS_LABEL[po.status] ?? po.status,
    rightCol,
    40,
  );
  writeMetadataRow(
    doc,
    "Pembayaran:",
    PAYMENT_LABEL[po.paymentStatus] ?? po.paymentStatus,
    rightCol,
    47,
  );
  writeMetadataRow(
    doc,
    "Tgl. Diharapkan:",
    formatDate(po.expectedDate),
    rightCol,
    54,
  );
  if (po.fakturPajakNo) {
    writeMetadataRow(doc, "Faktur Pajak:", po.fakturPajakNo, rightCol, 61);
  }

  if (po.notes) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text("Catatan:", leftCol, 72);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 41, 59);
    doc.text(doc.splitTextToSize(po.notes, 170), leftCol, 78);
  }

  let nextY = DEFAULT_TABLE_Y;
  const barangItems = po.items ?? [];
  const jasaItems = po.jasaItems ?? [];

  if (barangItems.length > 0) {
    autoTable(doc, {
      startY: nextY,
      head: [["NO", "NAMA BARANG", "QTY", "HARGA", "TOTAL"]],
      body: barangItems.map((item, index) => [
        String(index + 1),
        item.barang?.nama || "Barang tidak tersedia",
        String(item.quantity),
        formatCurrency(item.unitPrice),
        formatCurrency(item.totalPrice),
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
        3: { halign: "right", cellWidth: 35 },
        4: { halign: "right", cellWidth: 35 },
      },
    });
    nextY = (doc as AutoTableDoc).lastAutoTable?.finalY ?? nextY;
  }

  if (jasaItems.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(109, 40, 217);
    doc.text("ITEM JASA", 20, nextY + 10);

    autoTable(doc, {
      startY: nextY + 14,
      head: [["NO", "KODE", "NAMA JASA", "QTY", "HARGA", "TOTAL"]],
      body: jasaItems.map((item, index) => [
        String(index + 1),
        item.jasa.kode,
        item.jasa.nama,
        `${item.quantity} ${item.jasa.satuan}`,
        formatCurrency(item.unitPrice),
        formatCurrency(item.totalPrice),
      ]),
      theme: "grid",
      headStyles: {
        fillColor: [109, 40, 217],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: "bold",
        halign: "center",
      },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { halign: "center", cellWidth: 12 },
        3: { halign: "center", cellWidth: 22 },
        4: { halign: "right", cellWidth: 32 },
        5: { halign: "right", cellWidth: 32 },
      },
    });
    nextY = (doc as AutoTableDoc).lastAutoTable?.finalY ?? nextY;
  }

  const summaryY = nextY + 12;
  const labelX = pageWidth - 90;
  const valueX = pageWidth - 20;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);
  doc.text("Subtotal", labelX, summaryY);
  doc.text(formatCurrency(po.totalAmount), valueX, summaryY, {
    align: "right",
  });

  doc.text(`PPN (${po.ppnRate}%)`, labelX, summaryY + 7);
  doc.text(formatCurrency(po.ppnAmount), valueX, summaryY + 7, {
    align: "right",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Grand Total", labelX, summaryY + 16);
  doc.text(formatCurrency(po.grandTotal), valueX, summaryY + 16, {
    align: "right",
  });

  const signatureY = Math.min(summaryY + 45, 250);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);
  doc.text("Dibuat oleh,", 45, signatureY, { align: "center" });
  doc.line(20, signatureY + 28, 70, signatureY + 28);

  doc.text("Disetujui oleh,", pageWidth - 45, signatureY, {
    align: "center",
  });
  doc.line(pageWidth - 70, signatureY + 28, pageWidth - 20, signatureY + 28);

  const filename = sanitizePdfFilename(`PO-${po.poNumber}`);
  doc.save(`${filename}.pdf`);
  toast.success("PDF Purchase Order berhasil diunduh");
}

/**
 * Fetch detail PO lalu generate PDF. Dipakai dari list page.
 */
export async function downloadPurchaseOrderPdfById(
  poId: string,
): Promise<void> {
  const res = await fetch(`/api/admin/procurement/purchase-orders/${poId}`);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Gagal memuat data PO");
  }
  const po = (json.data ?? json) as PurchaseOrderPdfData;
  downloadPurchaseOrderPdf(po);
}
