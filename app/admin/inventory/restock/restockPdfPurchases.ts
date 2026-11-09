import type jsPDF from "jspdf";

import {
  buildPurchaseSignatureUrl,
  getPurchaseBuyerName,
} from "./restockPurchase";
import type { PurchaseRecordSummary } from "./types";

/**
 * Bagian "PEMBELIAN" di PDF pengajuan: tiap belanja dengan tanggal, toko,
 * barang, nama pembeli, dan gambar tanda tangannya. Tanda tangan diambil
 * lewat route ber-auth (same-origin) lalu diubah ke data URL sebelum PDF
 * digambar.
 */

/** recordId → data URL PNG, atau null bila gagal dimuat / tidak ada. */
export type PurchaseSignatureMap = Map<string, string | null>;

const MAX_PARALLEL_SIGNATURE_FETCHES = 4;
const PAGE_MARGIN_X = 20;
const PAGE_BOTTOM_MARGIN = 20;
const PAGE_TOP_Y = 20;
const TEXT_WIDTH = 170;
const LINE_HEIGHT = 5;
const SECTION_TITLE_GAP = 8;
/** Kotak maksimum tanda tangan (mm); gambar dimuatkan dengan rasio asli. */
const SIGNATURE_MAX_WIDTH = 40;
const SIGNATURE_MAX_HEIGHT = 15;
const RECORD_GAP = 6;

export const SIGNATURE_UNAVAILABLE_TEXT = "(tanda tangan tidak dapat dimuat)";
export const RECORDED_IN_APP_TEXT = "(dicatat dari aplikasi)";

const PDF_DATE_FORMAT = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

/** Potongan byte per String.fromCharCode supaya argumen tidak terlalu banyak. */
const BASE64_CHUNK_SIZE = 0x8000;

function toPngDataUrl(bytes: Uint8Array): string {
  let binary = "";
  for (let start = 0; start < bytes.length; start += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(
      ...bytes.subarray(start, start + BASE64_CHUNK_SIZE),
    );
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

async function fetchSignatureDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (blob.type && blob.type !== "image/png") return null;
    return toPngDataUrl(new Uint8Array(await blob.arrayBuffer()));
  } catch {
    return null;
  }
}

/** Ambil semua tanda tangan pembeli, paling banyak 4 sekaligus. */
export async function loadPurchaseSignatures(
  requestId: string,
  records: PurchaseRecordSummary[],
): Promise<PurchaseSignatureMap> {
  const signatures: PurchaseSignatureMap = new Map();
  const queue = records.filter((record) => record.hasSignature);
  const worker = async () => {
    for (let record = queue.shift(); record; record = queue.shift()) {
      signatures.set(
        record.id,
        await fetchSignatureDataUrl(
          buildPurchaseSignatureUrl(requestId, record.id),
        ),
      );
    }
  };
  const workerCount = Math.min(MAX_PARALLEL_SIGNATURE_FETCHES, queue.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return signatures;
}

/** "Kabel Fiber 6 roll, ONT 2 pcs". */
export function describePurchaseRecordItems(
  record: PurchaseRecordSummary,
): string {
  return record.items
    .map((item) =>
      [item.nama ?? "Barang", item.quantity, item.satuan]
        .filter((part) => part !== null && part !== "")
        .join(" "),
    )
    .join(", ");
}

/** "Dibeli oleh: Andi (lewat link)". */
export function describePurchaseBuyer(record: PurchaseRecordSummary): string {
  const suffix = record.source === "PUBLIC_LINK" ? " (lewat link)" : "";
  return `Dibeli oleh: ${getPurchaseBuyerName(record) ?? "-"}${suffix}`;
}

function describeRecordHeading(
  record: PurchaseRecordSummary,
  index: number,
): string {
  const date = PDF_DATE_FORMAT.format(new Date(record.purchasedAt));
  return `${index + 1}. ${date} - ${record.storeName}`;
}

/**
 * Ukuran tanda tangan di PDF: dimuatkan ke kotak 40x15 mm tanpa mengubah
 * rasio gambar. Kanvas di HP lebih tinggi rasionya daripada kotak ini, jadi
 * memaksakan ukuran kotak membuat tanda tangan melar ke samping.
 */
export function fitSignatureSize(
  imageWidth: number,
  imageHeight: number,
): { width: number; height: number } {
  if (imageWidth <= 0 || imageHeight <= 0) {
    return { width: SIGNATURE_MAX_WIDTH, height: SIGNATURE_MAX_HEIGHT };
  }
  const scale = Math.min(
    SIGNATURE_MAX_WIDTH / imageWidth,
    SIGNATURE_MAX_HEIGHT / imageHeight,
  );
  return { width: imageWidth * scale, height: imageHeight * scale };
}

function toLines(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

function drawSignature(
  doc: jsPDF,
  record: PurchaseRecordSummary,
  dataUrl: string | null | undefined,
  y: number,
): void {
  if (!record.hasSignature) {
    doc.text(RECORDED_IN_APP_TEXT, PAGE_MARGIN_X, y + LINE_HEIGHT);
    return;
  }
  if (dataUrl) {
    try {
      const image = doc.getImageProperties(dataUrl);
      const size = fitSignatureSize(image.width, image.height);
      doc.addImage(dataUrl, "PNG", PAGE_MARGIN_X, y, size.width, size.height);
      return;
    } catch {
      // Gambar rusak: jatuh ke teks pengganti di bawah.
    }
  }
  doc.text(SIGNATURE_UNAVAILABLE_TEXT, PAGE_MARGIN_X, y + LINE_HEIGHT);
}

/** Gambar satu belanja mulai di `y`; kembalikan `y` sesudahnya. */
function drawPurchaseRecord(
  doc: jsPDF,
  record: PurchaseRecordSummary,
  index: number,
  signature: string | null | undefined,
  startY: number,
): number {
  // Nama toko & nama pembeli bisa panjang (120 & 100 huruf), jadi semua
  // baris dibungkus ke lebar teks, diukur dengan huruf yang dipakai.
  doc.setFont("helvetica", "bold");
  const headingLines = toLines(
    doc.splitTextToSize(describeRecordHeading(record, index), TEXT_WIDTH),
  );
  doc.setFont("helvetica", "normal");
  const itemLines = toLines(
    doc.splitTextToSize(describePurchaseRecordItems(record), TEXT_WIDTH),
  );
  const buyerLines = toLines(
    doc.splitTextToSize(describePurchaseBuyer(record), TEXT_WIDTH),
  );
  const textLineCount =
    headingLines.length + itemLines.length + buyerLines.length;
  const blockHeight =
    LINE_HEIGHT * textLineCount + SIGNATURE_MAX_HEIGHT + RECORD_GAP;
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = startY;
  if (y + blockHeight > pageHeight - PAGE_BOTTOM_MARGIN) {
    doc.addPage();
    y = PAGE_TOP_Y;
  }

  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(headingLines, PAGE_MARGIN_X, y);
  y += LINE_HEIGHT * headingLines.length;
  doc.setFont("helvetica", "normal");
  doc.text(itemLines, PAGE_MARGIN_X, y);
  y += LINE_HEIGHT * itemLines.length;
  doc.text(buyerLines, PAGE_MARGIN_X, y);
  y += LINE_HEIGHT * (buyerLines.length - 1) + 2;
  doc.setTextColor(100, 116, 139);
  drawSignature(doc, record, signature, y);
  return y + SIGNATURE_MAX_HEIGHT + RECORD_GAP;
}

/**
 * Gambar bagian "PEMBELIAN" mulai di `startY` dan kembalikan `y` sesudahnya.
 * Tanpa catatan belanja, tidak menggambar apa pun.
 */
export function drawPurchaseSection(
  doc: jsPDF,
  startY: number,
  records: PurchaseRecordSummary[],
  signatures: PurchaseSignatureMap,
): number {
  if (records.length === 0) return startY;
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = startY;
  if (y + SECTION_TITLE_GAP * 3 > pageHeight - PAGE_BOTTOM_MARGIN) {
    doc.addPage();
    y = PAGE_TOP_Y;
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(79, 70, 229);
  doc.text("PEMBELIAN", PAGE_MARGIN_X, y);
  y += SECTION_TITLE_GAP;
  doc.setFontSize(9);
  records.forEach((record, index) => {
    y = drawPurchaseRecord(doc, record, index, signatures.get(record.id), y);
  });
  doc.setFontSize(10);
  return y;
}
