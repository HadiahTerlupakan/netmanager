import { parseRupiahInput, todayIsoDate } from "@/lib/utils/purchase-input";

import { BELANJA_TEXTS } from "./belanja-texts";

/**
 * Fungsi murni halaman daftar belanja publik: bentuk data dari server, nilai
 * awal isian, pemeriksaan isian, dan susunan body kiriman.
 */

/** Batas harga satuan; sama dengan batas server. */
const MAX_UNIT_PRICE = 1_000_000_000;
const LINK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const STORE_DATE_FORMAT = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Satu barang di daftar belanja (respons POST /api/belanja/daftar). */
export interface BelanjaItem {
  purchaseOrderItemId: string;
  name: string;
  unit: string | null;
  needed: number;
  purchased: number;
  remaining: number;
  /** Riwayat belanja barang ini; nama toko hanya ada di catatan lama. */
  stores: Array<{
    storeName: string | null;
    buyerName: string | null;
    purchasedAt: string;
    quantity: number;
  }>;
}

/** Daftar belanja seperti dikirim server. */
export interface BelanjaList {
  state: "ACTIVE" | "ALL_PURCHASED";
  requestNumber: string;
  warehouseName: string;
  validUntil: string;
  items: BelanjaItem[];
}

/** Isian satu barang. */
export interface BelanjaFormLine {
  purchaseOrderItemId: string;
  isChecked: boolean;
  /** Angka yang diketik; 0 berarti kosong. */
  quantity: number;
  /** Teks harga yang diketik; kosong berarti tidak diisi. */
  unitPrice: string;
}

/** Isian lengkap satu kali belanja. */
export interface BelanjaForm {
  /** "YYYY-MM-DD", tanggal lokal perangkat. */
  purchasedAt: string;
  notes: string;
  buyerName: string;
  lines: BelanjaFormLine[];
}

/** Isi kiriman POST /api/belanja/catat, tanpa token dan clientRequestId. */
export interface BelanjaSubmitInput {
  buyerName: string;
  purchasedAt: string;
  notes: string | null;
  signatureDataUrl: string;
  items: Array<{
    purchaseOrderItemId: string;
    quantity: number;
    unitPrice: number | null;
  }>;
}

/** Token dari fragmen URL ("#…"); null bila kosong atau bentuknya salah. */
export function readLinkToken(hash: string): string | null {
  const token = hash.startsWith("#") ? hash.slice(1) : hash;
  return LINK_TOKEN_PATTERN.test(token) ? token : null;
}

/** "2026-11-09" → "09 Nov 2026". */
export function formatStoreDate(isoDate: string): string {
  const time = Date.parse(`${isoDate}T00:00:00Z`);
  return Number.isNaN(time) ? isoDate : STORE_DATE_FORMAT.format(time);
}

function buildLine(item: BelanjaItem): BelanjaFormLine {
  return {
    purchaseOrderItemId: item.purchaseOrderItemId,
    isChecked: false,
    quantity: item.remaining,
    unitPrice: "",
  };
}

/** Isian kosong: jumlah = sisa, tanggal = hari ini, nama dari ingatan. */
export function buildInitialBelanjaForm(
  list: BelanjaList,
  buyerName: string,
  now: Date = new Date(),
): BelanjaForm {
  return {
    purchasedAt: todayIsoDate(now),
    notes: "",
    buyerName,
    lines: list.items.map(buildLine),
  };
}

/**
 * Daftar baru dari server tanpa membuang isian yang sedang diketik: barang
 * yang masih ada sisanya tetap tercentang dengan jumlah yang sama, supaya
 * pemeriksaan isian menunjukkan bila jumlahnya sekarang terlalu banyak.
 */
export function mergeBelanjaFormLines(
  form: BelanjaForm,
  list: BelanjaList,
): BelanjaForm {
  const previous = new Map(
    form.lines.map((line) => [line.purchaseOrderItemId, line]),
  );
  return {
    ...form,
    lines: list.items.map((item) => {
      const line = previous.get(item.purchaseOrderItemId);
      if (!line || item.remaining === 0) return buildLine(item);
      return line;
    }),
  };
}

function findLineProblem(
  line: BelanjaFormLine,
  item: BelanjaItem,
): string | null {
  const { problems } = BELANJA_TEXTS;
  if (!Number.isInteger(line.quantity) || line.quantity < 1) {
    return problems.tooFew(item.name);
  }
  if (line.quantity > item.remaining) {
    return problems.tooMany(item.name, item.remaining);
  }
  const price = parseRupiahInput(line.unitPrice);
  if (Number.isNaN(price)) return problems.badPrice(item.name);
  if (price !== null && price > MAX_UNIT_PRICE) {
    return problems.priceTooHigh(item.name);
  }
  return null;
}

/** Alasan isian belum bisa dikirim, urut dari atas ke bawah. */
export function findBelanjaFormProblems(
  form: BelanjaForm,
  items: BelanjaItem[],
  hasSignature: boolean,
  now: Date = new Date(),
): string[] {
  const { problems } = BELANJA_TEXTS;
  const found: string[] = [];
  const itemById = new Map(
    items.map((item) => [item.purchaseOrderItemId, item]),
  );
  const checked = form.lines.filter(
    (line) => line.isChecked && itemById.has(line.purchaseOrderItemId),
  );
  if (checked.length === 0) found.push(problems.noItem);
  for (const line of checked) {
    const item = itemById.get(line.purchaseOrderItemId);
    const problem = item ? findLineProblem(line, item) : null;
    if (problem) found.push(problem);
  }
  if (form.purchasedAt === "") {
    found.push(problems.noDate);
  } else if (form.purchasedAt > todayIsoDate(now)) {
    found.push(problems.futureDate);
  }
  if (form.buyerName.trim() === "") found.push(problems.noBuyer);
  if (!hasSignature) found.push(problems.noSignature);
  return found;
}

/** Isi kiriman dari isian yang sudah lolos pemeriksaan. */
export function buildBelanjaSubmitInput(
  form: BelanjaForm,
  signatureDataUrl: string,
): BelanjaSubmitInput {
  const notes = form.notes.trim();
  return {
    buyerName: form.buyerName.trim().replace(/\s+/g, " "),
    purchasedAt: form.purchasedAt,
    notes: notes === "" ? null : notes,
    signatureDataUrl,
    items: form.lines
      .filter((line) => line.isChecked)
      .map((line) => ({
        purchaseOrderItemId: line.purchaseOrderItemId,
        quantity: line.quantity,
        unitPrice: parseRupiahInput(line.unitPrice),
      })),
  };
}
