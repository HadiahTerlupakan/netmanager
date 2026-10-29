import { GState, jsPDF } from "jspdf";
import type {
  PpnMode,
  SampleCustomer,
  SampleInvoice,
  SampleIssuer,
  SamplePackage,
} from "../domain/types";
import { invoiceLines } from "../domain/money";

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
const GAP = 6;
const BOX_WIDTH = (RIGHT - MARGIN - GAP) / 2;
const BOX_PAD = 5;
const LINE = 4.6;

type Rgb = [number, number, number];
const INK: Rgb = [17, 24, 39];
const MUTED: Rgb = [107, 114, 128];
const RULE: Rgb = [229, 231, 235];
const PANEL: Rgb = [249, 250, 251];
const HEAD: Rgb = [31, 41, 55];
const PAID: Rgb = [22, 163, 74];
const PAID_SOFT: Rgb = [240, 253, 244];
const SAMPLE_RED: Rgb = [220, 38, 38];

const rupiah = (value: number) =>
  `${value < 0 ? "-" : ""}Rp${Math.abs(value).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;

function formatDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

function formatPeriod(month: string) {
  const [year, mon] = month.split("-").map(Number);
  return `${MONTHS_LONG[mon - 1]} ${year}`;
}

function packageLabel(pkg: SamplePackage) {
  return pkg.name.trim() === pkg.speed.trim()
    ? pkg.name
    : `${pkg.name} - ${pkg.speed}`;
}

function font(doc: jsPDF, style: string, size: number, color: Rgb = INK) {
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
}

function drawSampleBand(doc: jsPDF) {
  doc.setFillColor(...SAMPLE_RED);
  doc.rect(0, 0, PAGE_WIDTH, 12, "F");
  font(doc, "bold", 12, [255, 255, 255]);
  doc.text(SAMPLE_BAND_TEXT, PAGE_WIDTH / 2, 8, { align: "center" });
}

/** Dicetak paling akhir agar tidak tertutup kotak berlatar. */
function drawSampleWatermark(doc: jsPDF) {
  doc.saveGraphicsState();
  doc.setGState(new GState({ opacity: 0.12 }));
  font(doc, "bold", 110, SAMPLE_RED);
  doc.text("CONTOH", PAGE_WIDTH / 2, 190, { align: "center", angle: 30 });
  doc.restoreGraphicsState();
}

/** Mengembalikan y di bawah kepala dokumen. */
function drawHeader(doc: jsPDF, issuer: SampleIssuer, invoice: SampleInvoice) {
  font(doc, "bold", 15);
  doc.text(issuer.name, MARGIN, 26);
  font(doc, "normal", 9, MUTED);
  const lines = [
    ...doc.splitTextToSize(issuer.address, 105),
    issuer.phone && `Telp. ${issuer.phone}`,
  ].filter(Boolean);
  lines.forEach((line, i) => doc.text(line, MARGIN, 32 + i * 4.2));

  font(doc, "bold", 22);
  doc.text("INVOICE", RIGHT, 27, { align: "right" });
  font(doc, "normal", 9.5, MUTED);
  doc.text(`No. ${invoice.number}`, RIGHT, 33, { align: "right" });
  doc.setFillColor(...PAID);
  doc.roundedRect(RIGHT - 24, 36.5, 24, 7, 1.5, 1.5, "F");
  font(doc, "bold", 9.5, [255, 255, 255]);
  doc.text("LUNAS", RIGHT - 12, 41.2, { align: "center" });

  const bottom = Math.max(32 + lines.length * 4.2, 46) + 2;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, bottom, RIGHT, bottom);
  doc.setLineWidth(0.2);
  return bottom;
}

function drawPanel(doc: jsPDF, x: number, y: number, h: number, title: string) {
  doc.setFillColor(...PANEL);
  doc.setDrawColor(...RULE);
  doc.roundedRect(x, y, BOX_WIDTH, h, 2, 2, "FD");
  font(doc, "bold", 8, MUTED);
  doc.text(title, x + BOX_PAD, y + 7);
}

/** Mengembalikan y di bawah kedua kotak. */
function drawParties(
  doc: jsPDF,
  customer: SampleCustomer,
  invoice: SampleInvoice,
  top: number,
) {
  font(doc, "normal", 9.5);
  const address = doc.splitTextToSize(
    customer.address,
    BOX_WIDTH - 2 * BOX_PAD,
  );
  const details: Array<[string, string]> = [
    ["Periode", formatPeriod(invoice.month)],
    ["Jatuh tempo", formatDate(invoice.dueDate)],
    ["Tanggal bayar", formatDate(invoice.paidDate)],
    ["Metode", invoice.method],
  ];
  const leftBody = 6 + LINE * (2 + address.length);
  const height = 12 + Math.max(leftBody, LINE * details.length) + 3;
  const rightX = MARGIN + BOX_WIDTH + GAP;

  drawPanel(doc, MARGIN, top, height, "DITAGIHKAN KEPADA");
  let y = top + 14;
  font(doc, "bold", 11);
  doc.text(customer.name, MARGIN + BOX_PAD, y);
  font(doc, "normal", 9.5, MUTED);
  y += 6;
  for (const line of [`ID Pelanggan ${customer.code}`, ...address]) {
    doc.text(line, MARGIN + BOX_PAD, y);
    y += LINE;
  }
  doc.text(`HP ${customer.phoneMasked}`, MARGIN + BOX_PAD, y);

  drawPanel(doc, rightX, top, height, "DETAIL PEMBAYARAN");
  details.forEach(([label, value], i) => {
    const rowY = top + 14 + i * LINE * 1.3;
    font(doc, "normal", 9.5, MUTED);
    doc.text(label, rightX + BOX_PAD, rowY);
    font(doc, "bold", 9.5);
    doc.text(value, rightX + BOX_WIDTH - BOX_PAD, rowY, { align: "right" });
  });
  return top + height;
}

const PERIOD_X = 118;

/** Mengembalikan y di bawah tabel. */
function drawItems(
  doc: jsPDF,
  pkg: SamplePackage,
  invoice: SampleInvoice,
  ppn: PpnMode,
  top: number,
) {
  doc.setFillColor(...HEAD);
  doc.rect(MARGIN, top, RIGHT - MARGIN, 9, "F");
  font(doc, "bold", 9, [255, 255, 255]);
  doc.text("Deskripsi", MARGIN + 4, top + 6);
  doc.text("Periode", PERIOD_X, top + 6);
  doc.text("Jumlah", RIGHT - 4, top + 6, { align: "right" });

  const period = formatPeriod(invoice.month);
  const [packageLine, ...extraLines] = invoiceLines(pkg, ppn);
  let y = top + 9;
  font(doc, "bold", 10);
  doc.text(packageLabel(pkg), MARGIN + 4, y + 7.5);
  font(doc, "normal", 9.5, MUTED);
  doc.text("Layanan internet bulanan", MARGIN + 4, y + 12.1);
  font(doc, "normal", 10);
  doc.text(period, PERIOD_X, y + 7.5);
  doc.text(rupiah(packageLine.dpp), RIGHT - 4, y + 7.5, { align: "right" });
  y += 14;

  doc.setDrawColor(...RULE);
  for (const line of extraLines) {
    doc.line(MARGIN, y, RIGHT, y);
    font(doc, "normal", 10, line.dpp < 0 ? PAID : INK);
    doc.text(line.name, MARGIN + 4, y + 6.5);
    doc.text(period, PERIOD_X, y + 6.5);
    doc.text(rupiah(line.dpp), RIGHT - 4, y + 6.5, { align: "right" });
    y += 10;
  }
  doc.line(MARGIN, y, RIGHT, y);
  return y;
}

const SUMMARY_X = 112;

/** Mengembalikan y di bawah ringkasan. */
function drawSummary(
  doc: jsPDF,
  invoice: SampleInvoice,
  ppn: PpnMode,
  top: number,
) {
  let y = top + 8;
  if (ppn !== "none") {
    for (const [label, value] of [
      ["Subtotal", invoice.dpp],
      ["PPN 11%", invoice.ppn],
    ] as const) {
      font(doc, "normal", 10, MUTED);
      doc.text(label, SUMMARY_X + 4, y);
      font(doc, "normal", 10);
      doc.text(rupiah(value), RIGHT - 4, y, { align: "right" });
      y += 6.5;
    }
  }
  doc.setFillColor(...PAID_SOFT);
  doc.roundedRect(SUMMARY_X, y - 4, RIGHT - SUMMARY_X, 11, 1.5, 1.5, "F");
  font(doc, "bold", 10.5, INK);
  doc.text("Total dibayar", SUMMARY_X + 4, y + 2.8);
  font(doc, "bold", 12, PAID);
  doc.text(rupiah(invoice.total), RIGHT - 4, y + 2.8, { align: "right" });
  return y + 7;
}

function drawClosing(doc: jsPDF, invoice: SampleInvoice, top: number) {
  font(doc, "normal", 9.5, MUTED);
  doc.text(
    `Pembayaran diterima pada ${formatDate(invoice.paidDate)} melalui ${invoice.method}. Terima kasih.`,
    MARGIN,
    top + 12,
  );
  doc.setDrawColor(...RULE);
  doc.line(MARGIN, 274, RIGHT, 274);
  font(doc, "italic", 8, MUTED);
  doc.text(
    doc.splitTextToSize(SAMPLE_FOOTER_TEXT, RIGHT - MARGIN),
    MARGIN,
    280,
  );
}

export function renderSamplePdf(args: {
  issuer: SampleIssuer;
  customer: SampleCustomer;
  pkg: SamplePackage;
  invoice: SampleInvoice;
  ppn: PpnMode;
}): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawSampleBand(doc);
  const headerBottom = drawHeader(doc, args.issuer, args.invoice);
  const partiesBottom = drawParties(
    doc,
    args.customer,
    args.invoice,
    headerBottom + 8,
  );
  const itemsBottom = drawItems(
    doc,
    args.pkg,
    args.invoice,
    args.ppn,
    partiesBottom + 10,
  );
  const summaryBottom = drawSummary(doc, args.invoice, args.ppn, itemsBottom);
  drawClosing(doc, args.invoice, summaryBottom);
  drawSampleWatermark(doc);
  return Buffer.from(doc.output("arraybuffer"));
}
