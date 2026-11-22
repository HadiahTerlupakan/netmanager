/**
 * Status pengajuan restock. Pengajuan baru menunggu persetujuan atasan, lalu
 * disetujui atau ditolak. Pengajuan yang disetujui selesai saat admin
 * melaporkan barangnya sudah sampai (Sudah Sampai), atau dibatalkan admin
 * selama belum ada yang sampai (Dibatalkan).
 *
 * Murni, tanpa I/O: layar admin, presenter mobile, service, dan route memakai
 * aturan yang sama. Tipe inputnya struktural dan minimal supaya bekerja atas
 * JSON DTO maupun hasil Prisma.
 *
 * Keputusan per baris (`statusApproval`, `jumlahDiminta`, `barangIdDiminta`)
 * ditulis atasan saat menyetujui. Baris yang ditolak tidak ikut dilaporkan,
 * tidak ikut dipesan, dan tidak dihitung untuk status maupun jasa.
 */

/** Status pengajuan (DB) yang belum diputuskan atasan. */
export const AWAITING_APPROVAL_RESTOCK_STATUSES = [
  "DRAFT",
  "SUBMITTED",
] as const;

/**
 * Status pengajuan (DB) yang sudah disetujui dan masih terbuka: APPROVED, atau
 * ORDERED bila pesanannya sudah dibuat saat disetujui.
 */
export const APPROVED_OPEN_RESTOCK_STATUSES = ["APPROVED", "ORDERED"] as const;

/** Status pengajuan yang isinya masih boleh diubah pemohon: selama belum diputuskan atasan. */
export const RESTOCK_EDITABLE_STATUSES = AWAITING_APPROVAL_RESTOCK_STATUSES;

/** Status pengajuan seperti yang ditampilkan ke pengguna. */
export type RestockStatusKey =
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "RECEIVED"
  | "REJECTED"
  | "CANCELLED";

/** Label status untuk badge dan filter. */
export const RESTOCK_STATUS_LABELS: Record<RestockStatusKey, string> = {
  AWAITING_APPROVAL: "Menunggu Persetujuan",
  APPROVED: "Disetujui",
  RECEIVED: "Sudah Sampai",
  REJECTED: "Ditolak",
  CANCELLED: "Dibatalkan",
};

/** Alasan baku untuk sisa barang yang tidak sampai saat pengajuan diselesaikan. */
export const NOT_ENTERED_CANCEL_REASON = "Tidak sampai";

/** Alasan baku versi 2026-11-21, masih tersimpan pada pengajuan yang ditutup saat itu. */
const LEGACY_NOT_ENTERED_CANCEL_REASON = "Tidak dimasukkan ke gudang";

/** Alasan coret ini alasan baku sisa yang tidak sampai (versi kini maupun lama). */
export function isNotEnteredCancelReason(reason: string): boolean {
  return (
    reason === NOT_ENTERED_CANCEL_REASON ||
    reason === LEGACY_NOT_ENTERED_CANCEL_REASON
  );
}

/**
 * Nilai `statusKonfirmasi` jasa yang sudah dikonfirmasi selesai; sama dengan
 * yang ditulis `RestockJasaConfirmService` saat konfirmasi.
 */
export const RESTOCK_JASA_DONE_STATUS = "SELESAI";

/**
 * Satu baris barang. Angka pesanan (`orderedQuantity`, `receivedQuantity`,
 * `cancelledQuantity`) kosong bila pengajuan belum punya pesanan.
 */
export interface RestockStatusLine {
  /** Jumlah yang berlaku: yang diajukan, atau yang disetujui atasan. */
  jumlah: number;
  /** Jumlah yang semula diajukan; hanya terisi bila atasan mengubah jumlahnya. */
  jumlahDiminta?: number | null;
  orderedQuantity?: number | null;
  receivedQuantity?: number | null;
  cancelledQuantity?: number | null;
  /** Keputusan atasan untuk baris ini; hanya REJECTED yang dikecualikan. */
  statusApproval?: string | null;
  barangId?: string | null;
  /** Barang yang semula diajukan; hanya terisi bila barangnya diganti. */
  barangIdDiminta?: string | null;
}

/** Satu baris jasa. */
export interface RestockStatusJasa {
  statusKonfirmasi?: string | null;
  statusApproval?: string | null;
}

/** Pesanan pengajuan, seperlunya untuk status dan tindakan yang boleh. */
export interface RestockStatusOrder {
  status?: string | null;
  /**
   * Jumlah pengajuan yang memakai pesanan ini; lebih dari satu berarti
   * pesanan gabungan. Kosong dibaca sebagai pesanan milik satu pengajuan.
   */
  linkedRequestCount?: number;
}

/** Bagian pengajuan yang cukup untuk menentukan status dan tindakan yang boleh. */
export interface RestockStatusInput {
  status: string;
  purchaseOrderId?: string | null;
  purchaseOrder?: RestockStatusOrder | null;
  items: RestockStatusLine[];
  jasaItems?: RestockStatusJasa[] | null;
  goodsReceipts?: unknown[] | null;
}

/** Angka satu baris barang: dipesan, sudah masuk, tidak masuk, dan sisa. */
export interface RestockLineProgress {
  ordered: number;
  received: number;
  cancelled: number;
  remaining: number;
}

/** Keputusan atasan "ditolak" untuk satu baris. */
const REJECTED_LINE_APPROVAL = "REJECTED";
/** Pesanan dianggap gabungan bila dipakai lebih dari sekian pengajuan. */
const SINGLE_REQUEST_COUNT = 1;
/** Pesanan yang belum diproses masih boleh ikut dihapus bersama pengajuannya. */
const DELETABLE_ORDER_STATUS = "DRAFT";
/** Status tampilan pengajuan yang masih berjalan. */
const OPEN_STATUS_KEYS: readonly RestockStatusKey[] = [
  "AWAITING_APPROVAL",
  "APPROVED",
];

/** Status (DB) yang menutup pengajuan, di pengajuan maupun di pesanannya. */
type ClosingStatus = "RECEIVED" | "CANCELLED";

function isStatusIn(statuses: readonly string[], status: string): boolean {
  return statuses.includes(status);
}

/** Baris barang yang dihitung: semua kecuali yang ditolak atasan. */
function getActiveGoodsLines(input: RestockStatusInput): RestockStatusLine[] {
  return input.items.filter((line) => !isRestockLineRejected(line));
}

/** Baris jasa yang dihitung: semua kecuali yang ditolak atasan. */
function getActiveJasaLines(input: RestockStatusInput): RestockStatusJasa[] {
  return (input.jasaItems ?? []).filter((jasa) => !isRestockLineRejected(jasa));
}

function isJasaDone(jasa: RestockStatusJasa): boolean {
  return jasa.statusKonfirmasi === RESTOCK_JASA_DONE_STATUS;
}

/** Pengajuan sudah punya pesanan: id-nya saja atau objek pesanannya. */
function hasPurchaseOrder(input: RestockStatusInput): boolean {
  return Boolean(input.purchaseOrderId) || Boolean(input.purchaseOrder);
}

/** Pengajuan atau pesanannya sudah berstatus `status`. */
function isRequestOrOrderIn(
  input: RestockStatusInput,
  status: ClosingStatus,
): boolean {
  return input.status === status || input.purchaseOrder?.status === status;
}

/**
 * Data lama dan pesanan gabungan: semua barang sudah masuk atau dicoret
 * walaupun status pengajuannya belum ditutup.
 */
function isEveryGoodsLineSettled(input: RestockStatusInput): boolean {
  const lines = getActiveGoodsLines(input);
  return (
    lines.length > 0 &&
    lines.every((line) => getRestockLineProgress(line).remaining === 0)
  );
}

/** Baris (barang atau jasa) yang ditolak atasan saat persetujuan. */
export function isRestockLineRejected(
  line: Pick<RestockStatusLine | RestockStatusJasa, "statusApproval">,
): boolean {
  return line.statusApproval === REJECTED_LINE_APPROVAL;
}

/**
 * Angka satu baris barang; sisa tidak pernah negatif. Pada pengajuan yang
 * sudah ditutup (`isClosed`), sisa yang belum masuk tidak ditunggu lagi, jadi
 * dihitung sebagai tidak masuk.
 */
export function getRestockLineProgress(
  line: RestockStatusLine,
  isClosed = false,
): RestockLineProgress {
  const ordered = line.orderedQuantity ?? line.jumlah;
  const received = line.receivedQuantity ?? 0;
  const cancelled = line.cancelledQuantity ?? 0;
  const remaining = Math.max(ordered - received - cancelled, 0);
  if (!isClosed) return { ordered, received, cancelled, remaining };
  return { ordered, received, cancelled: cancelled + remaining, remaining: 0 };
}

/**
 * Status tampilan pengajuan, diperiksa berurutan:
 * 1. ditolak atasan → REJECTED;
 * 2. pengajuan atau pesanannya dibatalkan → CANCELLED;
 * 3. pengajuan atau pesanannya selesai → RECEIVED;
 * 4. belum diputuskan atasan → AWAITING_APPROVAL;
 * 5. sudah disetujui dan semua barangnya sudah masuk atau dicoret walaupun
 *    statusnya belum ditutup (data lama dan pesanan gabungan) → RECEIVED;
 * 6. selain itu → APPROVED (menunggu admin memasukkan barang).
 */
export function getRestockStatusKey(
  input: RestockStatusInput,
): RestockStatusKey {
  if (input.status === "REJECTED") return "REJECTED";
  if (isRequestOrOrderIn(input, "CANCELLED")) return "CANCELLED";
  if (isRequestOrOrderIn(input, "RECEIVED")) return "RECEIVED";
  if (isStatusIn(AWAITING_APPROVAL_RESTOCK_STATUSES, input.status)) {
    return "AWAITING_APPROVAL";
  }
  const isApproved = isStatusIn(APPROVED_OPEN_RESTOCK_STATUSES, input.status);
  if (isApproved && isEveryGoodsLineSettled(input)) return "RECEIVED";
  return "APPROVED";
}

/** Pengajuan sudah ditutup: dimasukkan, dibatalkan, atau ditolak. */
export function isRestockClosed(input: RestockStatusInput): boolean {
  return !OPEN_STATUS_KEYS.includes(getRestockStatusKey(input));
}

/**
 * Pesanan gabungan: satu pesanan dipakai lebih dari satu pengajuan, sehingga
 * barang yang masuk ke pesanan itu tidak bisa dipastikan milik pengajuan yang
 * mana.
 */
export function isRestockMergedOrder(
  input: Pick<RestockStatusInput, "purchaseOrder">,
): boolean {
  const linkedRequestCount =
    input.purchaseOrder?.linkedRequestCount ?? SINGLE_REQUEST_COUNT;
  return linkedRequestCount > SINGLE_REQUEST_COUNT;
}

/** Ada jasa pengajuan ini (yang tidak ditolak) yang sudah dikonfirmasi selesai. */
export function hasRestockJasaDone(input: RestockStatusInput): boolean {
  return getActiveJasaLines(input).some(isJasaDone);
}

/**
 * Sudah ada yang masuk dari pengajuan ini: ada catatan barang masuk, ada baris
 * barang yang sudah diterima, atau ada jasa yang sudah dikonfirmasi selesai.
 * Angka barang dibaca di tingkat pesanan, jadi pada pesanan gabungan ikut
 * menghitung barang pengajuan lain.
 */
export function hasRestockEnteredAnything(input: RestockStatusInput): boolean {
  if ((input.goodsReceipts?.length ?? 0) > 0) return true;
  const hasReceivedGoods = getActiveGoodsLines(input).some(
    (line) => (line.receivedQuantity ?? 0) > 0,
  );
  return hasReceivedGoods || hasRestockJasaDone(input);
}

/** Pengajuan tanpa barang yang dihitung, hanya jasa. */
export function isRestockServiceOnly(input: RestockStatusInput): boolean {
  return (
    getActiveGoodsLines(input).length === 0 &&
    getActiveJasaLines(input).length > 0
  );
}

/**
 * "Lapor Barang Sampai" boleh dipakai: pengajuan sudah disetujui, belum ditutup,
 * dan punya barang yang tidak ditolak.
 */
export function canEnterRestockGoods(input: RestockStatusInput): boolean {
  return (
    getRestockStatusKey(input) === "APPROVED" &&
    getActiveGoodsLines(input).length > 0
  );
}

/**
 * Pengajuan boleh dibatalkan admin: sudah disetujui, belum ditutup, dan belum
 * ada yang masuk dari pengajuan ini. Pada pesanan gabungan, barang yang masuk
 * ke pesanan tidak bisa dipastikan milik pengajuan ini (dan Batalkan tidak
 * mencoret apa pun selama pengajuan lain masih terbuka), jadi yang menahan
 * hanya jasa pengajuan ini yang sudah selesai. Pengajuan yang belum
 * diputuskan ditolak atasan, bukan dibatalkan.
 */
export function canCancelRestockRequest(input: RestockStatusInput): boolean {
  if (getRestockStatusKey(input) !== "APPROVED") return false;
  return isRestockMergedOrder(input)
    ? !hasRestockJasaDone(input)
    : !hasRestockEnteredAnything(input);
}

/** Isi pengajuan boleh diubah pemohon: belum diputuskan atasan dan belum punya pesanan. */
export function canEditRestockRequest(input: RestockStatusInput): boolean {
  return (
    isStatusIn(RESTOCK_EDITABLE_STATUSES, input.status) &&
    !hasPurchaseOrder(input)
  );
}

/**
 * Pengajuan boleh dihapus: belum Sudah Sampai, pesanannya (bila ada) masih
 * DRAFT, dan belum ada yang masuk. `purchaseOrderId` tanpa objek
 * `purchaseOrder` berarti status pesanannya tidak diketahui, jadi tidak boleh.
 */
export function canDeleteRestockRequest(input: RestockStatusInput): boolean {
  if (input.status === "RECEIVED") return false;
  const isOrderDeletable =
    !hasPurchaseOrder(input) ||
    input.purchaseOrder?.status === DELETABLE_ORDER_STATUS;
  return isOrderDeletable && !hasRestockEnteredAnything(input);
}

/** Jumlah yang semula diajukan pemohon, sebelum diubah atasan. */
export function getRequestedQuantity(
  line: Pick<RestockStatusLine, "jumlah" | "jumlahDiminta">,
): number {
  return line.jumlahDiminta ?? line.jumlah;
}

/**
 * Barang baris ini sudah diganti dari barang yang semula diajukan pemohon,
 * oleh atasan saat menyetujui atau oleh admin saat memasukkan barang.
 */
export function wasRestockLineSubstituted(
  line: Pick<RestockStatusLine, "barangId" | "barangIdDiminta">,
): boolean {
  return (
    Boolean(line.barangIdDiminta) && line.barangIdDiminta !== line.barangId
  );
}
