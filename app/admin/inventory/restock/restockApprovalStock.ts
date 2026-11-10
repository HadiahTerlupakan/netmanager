/**
 * Stok gudang tujuan sebagai bahan pertimbangan approver. Hanya informasi:
 * tidak memblokir keputusan. "Bisa dipakai" = total dikurangi yang rusak
 * (Baru + Bekas); total tetap memakai kolom `stok` yang menjadi acuan sistem,
 * jadi rincian kondisi yang belum cocok dengan total disebut terang-terangan.
 */

/** Stok satu barang di gudang tujuan (respons GET .../requests/[id]/stok). */
export interface ApprovalStockItem {
  barangId: string;
  stok: number;
  stokBaru: number;
  stokBekas: number;
  stokRusak: number;
  /** Null bila minimum tidak diatur. */
  minStok: number | null;
}

/** Isi `data` respons stok gudang pengajuan. */
export interface ApprovalStockResponse {
  gudangId: string;
  gudangName: string | null;
  items: ApprovalStockItem[];
  /** ISO, waktu stok dibaca server. */
  fetchedAt: string;
}

/**
 * Warna kesimpulan: `danger` tidak ada yang bisa dipakai, `warning` kurang
 * atau di bawah minimum, `enough` stok sudah menutup jumlah yang diajukan.
 */
export type ApprovalStockTone = "danger" | "warning" | "enough";

/** Ringkasan stok satu baris untuk ditampilkan di modal persetujuan. */
export interface ApprovalStockSummary {
  tone: ApprovalStockTone;
  /** "Stok di gudang ini: 12 roll". */
  totalText: string;
  /** "Baru 8 · Bekas 3 · Rusak 1"; null bila stok kosong. */
  conditionText: string | null;
  /** Kesimpulan dibanding jumlah yang diajukan. */
  verdict: string;
  /** Catatan tambahan: minimum, rincian kondisi tidak cocok. */
  notes: string[];
}

function withUnit(quantity: number, satuan: string): string {
  return satuan ? `${quantity} ${satuan}` : String(quantity);
}

const EMPTY_STOCK: Omit<ApprovalStockItem, "barangId"> = {
  stok: 0,
  stokBaru: 0,
  stokBekas: 0,
  stokRusak: 0,
  minStok: null,
};

/** Stok yang bisa dipakai: total dikurangi yang rusak, tidak pernah minus. */
export function getUsableStock(
  stock: Pick<ApprovalStockItem, "stok" | "stokRusak">,
): number {
  return Math.max(stock.stok - stock.stokRusak, 0);
}

function describeVerdict(
  stock: Omit<ApprovalStockItem, "barangId">,
  usable: number,
  quantity: number,
  satuan: string,
): { tone: ApprovalStockTone; verdict: string } {
  if (stock.stok <= 0) {
    return { tone: "danger", verdict: "Stok habis di gudang ini." };
  }
  if (usable === 0) {
    return {
      tone: "danger",
      verdict: "Semua stok rusak, tidak ada yang bisa dipakai.",
    };
  }
  if (usable >= quantity) {
    return {
      tone: "enough",
      verdict: `Stok yang bisa dipakai (${withUnit(usable, satuan)}) sudah cukup untuk ${withUnit(quantity, satuan)} yang diajukan.`,
    };
  }
  return {
    tone: "warning",
    verdict: `Stok yang bisa dipakai (${withUnit(usable, satuan)}) kurang ${withUnit(quantity - usable, satuan)} dari yang diajukan.`,
  };
}

function describeNotes(
  stock: Omit<ApprovalStockItem, "barangId">,
  usable: number,
  quantity: number,
  satuan: string,
): string[] {
  const notes: string[] = [];
  if (stock.minStok !== null && usable < stock.minStok) {
    notes.push(
      `Di bawah stok minimum gudang ini (${withUnit(stock.minStok, satuan)}). Setelah barang datang: ${withUnit(usable + quantity, satuan)}.`,
    );
  }
  const recorded = stock.stokBaru + stock.stokBekas + stock.stokRusak;
  if (stock.stok > 0 && recorded !== stock.stok) {
    notes.push(
      `Rincian kondisi (${recorded}) belum cocok dengan total stok (${stock.stok}). Cek dengan stock opname.`,
    );
  }
  return notes;
}

/**
 * Ringkasan stok satu barang dibanding jumlah yang sedang dipertimbangkan.
 * Barang yang belum pernah tercatat di gudang ini dianggap stok 0.
 */
export function describeApprovalStock(
  stock: ApprovalStockItem | undefined,
  quantity: number,
  satuan: string,
): ApprovalStockSummary {
  const current = stock ?? EMPTY_STOCK;
  const usable = getUsableStock(current);
  const { tone, verdict } = describeVerdict(current, usable, quantity, satuan);
  return {
    tone,
    totalText: `Stok di gudang ini: ${withUnit(current.stok, satuan)}`,
    conditionText:
      current.stok > 0
        ? `Baru ${current.stokBaru} · Bekas ${current.stokBekas} · Rusak ${current.stokRusak}`
        : null,
    verdict,
    notes: describeNotes(current, usable, quantity, satuan),
  };
}
