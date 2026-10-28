import { GState, jsPDF } from "jspdf";
import type {
  PpnMode,
  SampleCustomer,
  SampleInvoice,
  SampleIssuer,
  SamplePackage,
} from "../domain/types";

/**
 * Satu halaman invoice contoh. Pita, watermark, dan catatan kaki CONTOH
 * dicetak tanpa syarat: tidak ada parameter untuk mematikannya, karena
 * dokumen ini fiktif dan tidak boleh tertukar dengan tagihan asli.
 */
export const SAMPLE_BAND_TEXT = "CONTOH — BUKAN TAGIHAN ASLI";
export const SAMPLE_FOOTER_TEXT =
  "Dokumen ini dibuat otomatis sebagai contoh format. Nama, alamat, dan transaksi bersifat fiktif.";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];
const MONTHS_LONG = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
const PAGE_WIDTH = 210;
const MARGIN = 15;
const RIGHT = PAGE_WIDTH - MARGIN;

const rupiah = (value: number) =>
  `Rp${value.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;

function formatDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

function formatPeriod(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return `${MONTHS_LONG[mon - 1]} ${year}`;
}

function drawSampleMarks(doc: jsPDF) {
  doc.setFillColor(220, 38, 38);
  doc.rect(0, 0, PAGE_WIDTH, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(SAMPLE_BAND_TEXT, PAGE_WIDTH / 2, 8, { align: "center" });

  doc.saveGraphicsState();
  doc.setGState(new GState({ opacity: 0.12 }));
  doc.setTextColor(220, 38, 38);
  doc.setFontSize(110);
  doc.text("CONTOH", PAGE_WIDTH / 2, 190, { align: "center", angle: 30 });
  doc.restoreGraphicsState();
}

function drawHeader(doc: jsPDF, issuer: SampleIssuer, invoice: SampleInvoice) {
  doc.setTextColor(17, 17, 17);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(issuer.name, MARGIN, 26);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text([issuer.address, issuer.phone].filter(Boolean), MARGIN, 32);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("INVOICE", RIGHT, 26, { align: "right" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`No: ${invoice.number}`, RIGHT, 32, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(22, 163, 74);
  doc.text("LUNAS", RIGHT, 38, { align: "right" });
  doc.setTextColor(17, 17, 17);
  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN, 44, RIGHT, 44);
}

function drawParties(
  doc: jsPDF,
  customer: SampleCustomer,
  invoice: SampleInvoice,
) {
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Kepada", MARGIN, 52);
  doc.setFont("helvetica", "normal");
  doc.text(
    [
      `${customer.name} (ID ${customer.code})`,
      ...doc.splitTextToSize(customer.address, 100),
      `HP ${customer.phoneMasked}`,
    ],
    MARGIN,
    58,
  );
  doc.text(
    [
      `Periode: ${formatPeriod(invoice.month)}`,
      `Jatuh tempo: ${formatDate(invoice.dueDate)}`,
      `Dibayar: ${formatDate(invoice.paidDate)}`,
      `Metode: ${invoice.method}`,
    ],
    RIGHT,
    58,
    { align: "right" },
  );
}

function drawAmounts(
  doc: jsPDF,
  pkg: SamplePackage,
  invoice: SampleInvoice,
  ppn: PpnMode,
) {
  let y = 92;
  doc.setFont("helvetica", "bold");
  doc.text("Rincian", MARGIN, y);
  doc.text("Jumlah", RIGHT, y, { align: "right" });
  doc.line(MARGIN, y + 2, RIGHT, y + 2);
  doc.setFont("helvetica", "normal");
  const rows: Array<[string, number]> = [
    [`${pkg.name} - ${pkg.speed}, ${formatPeriod(invoice.month)}`, invoice.dpp],
  ];
  if (ppn !== "none") rows.push(["PPN 11%", invoice.ppn]);
  for (const [label, value] of rows) {
    y += 8;
    doc.text(label, MARGIN, y);
    doc.text(rupiah(value), RIGHT, y, { align: "right" });
  }
  y += 4;
  doc.line(MARGIN, y, RIGHT, y);
  y += 7;
  doc.setFont("helvetica", "bold");
  doc.text("Total dibayar", MARGIN, y);
  doc.text(rupiah(invoice.total), RIGHT, y, { align: "right" });
}

export function renderSamplePdf(args: {
  issuer: SampleIssuer;
  customer: SampleCustomer;
  pkg: SamplePackage;
  invoice: SampleInvoice;
  ppn: PpnMode;
}): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawSampleMarks(doc);
  drawHeader(doc, args.issuer, args.invoice);
  drawParties(doc, args.customer, args.invoice);
  drawAmounts(doc, args.pkg, args.invoice, args.ppn);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(102, 102, 102);
  doc.text(
    doc.splitTextToSize(SAMPLE_FOOTER_TEXT, RIGHT - MARGIN),
    MARGIN,
    280,
  );
  return Buffer.from(doc.output("arraybuffer"));
}
