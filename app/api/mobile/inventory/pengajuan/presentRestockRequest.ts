/**
 * Bentuk pengajuan barang (restock) untuk layar "Pengajuan Barang" di aplikasi
 * mobile. Status dihitung dengan aturan bersama modul inventory
 * (`getRestockStatusKey`), jadi site dan admin selalu melihat keadaan yang
 * sama. Site hanya melihat dan menunggu: pengajuan yang menunggu persetujuan
 * atasan dan yang sudah disetujui sama-sama berlabel "Sudah Diajukan", dengan
 * kalimat yang berbeda.
 *
 * Data persetujuan yang dibaca: `statusApproval` menandai barang yang ditolak
 * (dan menyaring jasa), `catatanApproval` baris menjadi catatan atasan,
 * `catatanApproval` pengajuan menjadi alasan penolakan, dan `jumlahDiminta`,
 * `barangIdDiminta`, `barangDiminta` memberi jumlah dan barang yang semula
 * diajukan bila atasan atau admin mengubahnya.
 */
import {
  getRequestedQuantity,
  getRestockStatusKey,
  isRestockClosed,
  isRestockLineRejected,
  isRestockServiceOnly,
  RESTOCK_STATUS_LABELS,
  wasRestockLineSubstituted,
  type RestockStatusInput,
  type RestockStatusKey,
  type RestockStatusLine,
} from "@/modules/inventory";

/** Ringkasan barang yang dibaca presenter. */
interface MobileRestockBarangSource {
  nama?: string | null;
  satuan?: string | null;
}

/** Satu baris barang dari read model pengajuan restock. */
export interface MobileRestockLineSource extends RestockStatusLine {
  id: string;
  /** Catatan atasan untuk baris ini, ditulis saat persetujuan. */
  catatanApproval?: string | null;
  barang?: MobileRestockBarangSource | null;
  barangDiminta?: MobileRestockBarangSource | null;
}

/**
 * Bagian read model pengajuan restock yang dibaca presenter. `tanggal` boleh
 * `Date` (langsung dari repository) atau teks ISO (sudah lewat JSON).
 */
export interface MobileRestockSource extends RestockStatusInput {
  id: string;
  nomorRequest: string;
  tanggal: Date | string;
  gudang?: { nama?: string | null } | null;
  requester?: { name?: string | null } | null;
  /** Catatan atasan saat memutuskan; menjadi alasan bila pengajuan ditolak. */
  catatanApproval?: string | null;
  /** Alasan admin membatalkan pengajuan. */
  cancelReason?: string | null;
  items: MobileRestockLineSource[];
}

/**
 * Field baris untuk build aplikasi sebelum alur pencatat, diturunkan dari
 * angka barang masuk supaya build itu tetap tampil masuk akal. Hapus semuanya
 * setelah rilis Play Store berikutnya diwajibkan (build lama terkunci).
 */
interface LegacyMobileRestockLineFields {
  /** @deprecated Tahap pembelian sudah dihapus; sama dengan `datang`. */
  dibeli: number;
  /** @deprecated Jumlah yang sudah masuk gudang; aplikasi baru membaca `dimasukkan`. */
  datang: number;
  /** @deprecated Pengajuan tertutup: jumlah yang tidak masuk; selain itu yang sudah dicoret. */
  tidakDatang: number;
}

/** Satu barang di kartu pengajuan. */
export interface MobileRestockLine extends LegacyMobileRestockLineFields {
  id: string;
  /** Nama barang yang berlaku, dengan barang asal bila barangnya diganti. */
  nama: string;
  /** Satuan barang yang berlaku (barang pengganti bila diganti). */
  satuan: string;
  /** Jumlah yang semula diajukan pemohon. */
  diminta: number;
  /** Satuan jumlah yang diajukan (barang asal bila diganti). */
  satuanDiminta: string;
  /**
   * Jumlah yang disetujui atasan, dalam `satuan`. Null bila pengajuan belum
   * diputuskan atasan atau barangnya ditolak.
   */
  disetujui: number | null;
  /**
   * Jumlah yang sudah dimasukkan admin ke gudang, dalam `satuan`. Null bila
   * belum ada yang dimasukkan atau barangnya ditolak; angka (boleh 0) bila
   * pengajuan Sudah Sampai atau sudah ada barang yang masuk.
   */
  dimasukkan: number | null;
  isDitolak: boolean;
  /** Catatan atasan untuk barang ini: alasan menolak, mengganti, atau mengubah jumlah. */
  catatanAtasan: string | null;
}

/** Garis tahap untuk build lama: selalu kosong supaya tidak tergambar. */
interface LegacyEmptyStage {
  readonly sekarang: null;
  readonly berhentiDi: null;
  readonly total: 0;
  readonly judul: readonly [];
}

/** Satu pengajuan seperti ditampilkan di aplikasi mobile. */
export interface MobileRestockRequest {
  id: string;
  nomor: string;
  /** ISO. */
  tanggal: string;
  gudang: string;
  pemohon: string | null;
  status: { kode: RestockStatusKey; label: string; kalimat: string };
  /** @deprecated Untuk build lama; hapus setelah rilis Play Store berikutnya diwajibkan. */
  tahap: LegacyEmptyStage;
  barang: MobileRestockLine[];
  jumlahJasa: number;
}

/** Label dan kalimat status untuk site, yang hanya bisa melihat dan menunggu. */
interface SiteStatusCopy {
  label: string;
  kalimat: string;
  /** Kalimat untuk pengajuan yang hanya berisi jasa; bila kosong, `kalimat` dipakai. */
  kalimatJasa?: string;
}

/** Bagi site, menunggu persetujuan dan menunggu barang dimasukkan sama-sama "sudah diajukan". */
const SUBMITTED_SITE_LABEL = "Sudah Diajukan";

const SITE_STATUS_COPY: Record<RestockStatusKey, SiteStatusCopy> = {
  AWAITING_APPROVAL: {
    label: SUBMITTED_SITE_LABEL,
    kalimat: "Menunggu persetujuan atasan.",
  },
  APPROVED: {
    label: SUBMITTED_SITE_LABEL,
    kalimat: "Sudah disetujui. Menunggu barangnya sampai.",
    kalimatJasa: "Sudah disetujui. Menunggu admin mengonfirmasi jasanya.",
  },
  RECEIVED: {
    label: RESTOCK_STATUS_LABELS.RECEIVED,
    kalimat: "Barangnya sudah sampai.",
    kalimatJasa: "Jasanya sudah dikonfirmasi admin.",
  },
  REJECTED: {
    label: RESTOCK_STATUS_LABELS.REJECTED,
    kalimat: "Pengajuan ini tidak disetujui.",
  },
  CANCELLED: {
    label: RESTOCK_STATUS_LABELS.CANCELLED,
    kalimat: "Pengajuan ini dibatalkan admin.",
  },
};

const LEGACY_EMPTY_STAGE: LegacyEmptyStage = {
  sekarang: null,
  berhentiDi: null,
  total: 0,
  judul: [],
};

/** Keadaan pengajuan yang menentukan angka tiap baris. */
interface RequestState {
  kode: RestockStatusKey;
  isClosed: boolean;
}

/** Keadaan satu baris, dipakai bersama field baru dan field lama. */
interface LineState extends RequestState {
  isDitolak: boolean;
  received: number;
}

/** Tanggal dari repository (`Date`) atau JSON (teks ISO) sebagai teks ISO. */
function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

/** Alasan yang ditulis untuk pengajuan yang ditolak atasan atau dibatalkan admin. */
function getStatusReason(
  source: MobileRestockSource,
  kode: RestockStatusKey,
): string | null {
  if (kode === "REJECTED") return source.catatanApproval ?? null;
  if (kode === "CANCELLED") return source.cancelReason ?? null;
  return null;
}

function buildStatusSentence(
  source: MobileRestockSource,
  kode: RestockStatusKey,
): string {
  const copy = SITE_STATUS_COPY[kode];
  const sentence = isRestockServiceOnly(source)
    ? (copy.kalimatJasa ?? copy.kalimat)
    : copy.kalimat;
  const reason = getStatusReason(source, kode)?.trim();
  return reason ? `${sentence} Alasan: ${reason}` : sentence;
}

function getLineName(item: MobileRestockLineSource): string {
  const nama = item.barang?.nama || "Barang";
  if (!wasRestockLineSubstituted(item)) return nama;
  return `${nama} (pengganti ${item.barangDiminta?.nama ?? "barang lain"})`;
}

/** Satuan jumlah yang diajukan: satuan barang asal bila barangnya diganti. */
function getRequestedSatuan(item: MobileRestockLineSource): string {
  const satuan = item.barang?.satuan || "";
  if (!wasRestockLineSubstituted(item)) return satuan;
  return item.barangDiminta?.satuan || satuan;
}

/** Jumlah yang disetujui atasan; null selama belum diputuskan atau bila ditolak. */
function getApprovedQuantity(
  item: MobileRestockLineSource,
  state: LineState,
): number | null {
  if (state.isDitolak || state.kode === "AWAITING_APPROVAL") return null;
  return item.jumlah;
}

/**
 * Jumlah yang sudah dimasukkan; null bila belum ada. Pengajuan yang Sudah
 * Dimasukkan selalu punya angka, termasuk 0 untuk barang yang tidak masuk.
 */
function getEnteredQuantity(state: LineState): number | null {
  if (state.isDitolak) return null;
  const hasEntered = state.kode === "RECEIVED" || state.received > 0;
  return hasEntered ? state.received : null;
}

function getLegacyNotArrived(
  item: MobileRestockLineSource,
  state: LineState,
): number {
  if (state.isDitolak) return 0;
  if (state.isClosed) return Math.max(item.jumlah - state.received, 0);
  return item.cancelledQuantity ?? 0;
}

function toLegacyLineFields(
  item: MobileRestockLineSource,
  state: LineState,
): LegacyMobileRestockLineFields {
  return {
    dibeli: state.received,
    datang: state.received,
    tidakDatang: getLegacyNotArrived(item, state),
  };
}

function toLine(
  item: MobileRestockLineSource,
  request: RequestState,
): MobileRestockLine {
  const isDitolak = request.kode === "REJECTED" || isRestockLineRejected(item);
  const state: LineState = {
    ...request,
    isDitolak,
    received: isDitolak ? 0 : (item.receivedQuantity ?? 0),
  };
  return {
    id: item.id,
    nama: getLineName(item),
    satuan: item.barang?.satuan || "",
    diminta: getRequestedQuantity(item),
    satuanDiminta: getRequestedSatuan(item),
    disetujui: getApprovedQuantity(item, state),
    dimasukkan: getEnteredQuantity(state),
    isDitolak,
    catatanAtasan: item.catatanApproval ?? null,
    ...toLegacyLineFields(item, state),
  };
}

/** Barang yang ditolak ditaruh paling bawah supaya yang ditunggu terlihat dulu. */
function byRejectedLast(a: MobileRestockLine, b: MobileRestockLine): number {
  return Number(a.isDitolak) - Number(b.isDitolak);
}

function countActiveJasa(source: MobileRestockSource): number {
  return (source.jasaItems ?? []).filter((jasa) => !isRestockLineRejected(jasa))
    .length;
}

/** Bentuk satu pengajuan dari read model restock untuk aplikasi mobile. */
export function presentRestockRequestForMobile(
  source: MobileRestockSource,
): MobileRestockRequest {
  const kode = getRestockStatusKey(source);
  const request: RequestState = { kode, isClosed: isRestockClosed(source) };
  return {
    id: source.id,
    nomor: source.nomorRequest,
    tanggal: toIsoString(source.tanggal),
    gudang: source.gudang?.nama || "-",
    pemohon: source.requester?.name ?? null,
    status: {
      kode,
      label: SITE_STATUS_COPY[kode].label,
      kalimat: buildStatusSentence(source, kode),
    },
    tahap: LEGACY_EMPTY_STAGE,
    barang: source.items
      .map((item) => toLine(item, request))
      .sort(byRejectedLast),
    jumlahJasa: kode === "REJECTED" ? 0 : countActiveJasa(source),
  };
}
