import type {
  Indikator,
  PenilaianKepala,
  PenilaianSales,
  PredikatPenilaian,
  TampilanStatus,
} from "@/modules/presurvei/client";

/** Label dan warna badge tiap predikat penilaian. */
export const PREDIKAT_CONFIG: Record<PredikatPenilaian, TampilanStatus> = {
  SANGAT_BAIK: { label: "Sangat baik", warna: "bg-emerald-100 text-emerald-700" },
  BAIK: { label: "Baik", warna: "bg-blue-100 text-blue-700" },
  CUKUP: { label: "Cukup", warna: "bg-amber-100 text-amber-700" },
  PERLU_PEMBINAAN: { label: "Perlu pembinaan", warna: "bg-red-100 text-red-700" },
};

/** Badge untuk skor yang belum bisa diukur sama sekali. */
export const TAMPILAN_BELUM_TERUKUR: TampilanStatus = {
  label: "Belum terukur",
  warna: "bg-gray-100 text-gray-600",
};

/** Warna bilah indikator mengikuti predikat nilainya. */
const WARNA_BILAH: Record<PredikatPenilaian, string> = {
  SANGAT_BAIK: "bg-emerald-500",
  BAIK: "bg-blue-500",
  CUKUP: "bg-amber-500",
  PERLU_PEMBINAAN: "bg-red-500",
};

export const LABEL_INDIKATOR_SALES: Record<keyof PenilaianSales["indikator"], string> = {
  aktivitas: "Aktivitas (kunjungan & prospek)",
  konversi: "Konversi",
  realisasi: "Realisasi rencana",
};

export const LABEL_INDIKATOR_KEPALA: Record<keyof PenilaianKepala["indikator"], string> = {
  aktivitasTim: "Aktivitas tim",
  konversiTim: "Konversi tim",
  realisasiPenugasan: "Realisasi penugasan",
  cakupanPembinaan: "Cakupan pembinaan",
  kinerjaPribadi: "Kinerja pribadi",
};

/** Indikator siap tampil: label, nilai, bobot. */
export interface BarisIndikator extends Indikator {
  kunci: string;
  label: string;
}

/** Urutkan indikator mengikuti urutan label (= urutan bobot di domain). */
export function daftarIndikator<K extends string>(
  indikator: Record<K, Indikator>,
  label: Record<K, string>,
): BarisIndikator[] {
  return (Object.keys(label) as K[]).map((kunci) => ({
    kunci,
    label: label[kunci],
    ...indikator[kunci],
  }));
}

/** Indikator terukur dengan nilai terendah — petunjuk apa yang perlu dibenahi. */
export function indikatorTerlemah(daftar: readonly BarisIndikator[]): BarisIndikator | null {
  return daftar.reduce<BarisIndikator | null>((terendah, baris) => {
    if (baris.nilai === null) return terendah;
    if (terendah === null || baris.nilai < (terendah.nilai as number)) return baris;
    return terendah;
  }, null);
}

/** Tampilan badge untuk predikat (null = belum terukur). */
export function tampilanPredikat(predikat: PredikatPenilaian | null): TampilanStatus {
  return predikat === null ? TAMPILAN_BELUM_TERUKUR : PREDIKAT_CONFIG[predikat];
}

/** Kelas warna bilah untuk sebuah nilai 0–100. */
export function warnaBilah(nilai: number, tentukan: (skor: number) => PredikatPenilaian | null): string {
  const predikat = tentukan(nilai);
  return predikat === null ? "bg-gray-300" : WARNA_BILAH[predikat];
}

/** "87" atau "—" bila belum terukur. */
export function teksSkor(skor: number | null): string {
  return skor === null ? "—" : String(skor);
}

/** Filter predikat di tabel anggota; SEMUA = tanpa filter. */
export type FilterPredikat = PredikatPenilaian | "SEMUA" | "BELUM_TERUKUR";

/** Anggota tim seorang kepala sales (tanpa kepala itu sendiri), disaring predikat. */
export function anggotaTim(
  sales: readonly PenilaianSales[],
  kepalaId: string,
  filter: FilterPredikat,
): PenilaianSales[] {
  return sales.filter((item) => {
    if (item.salesId === kepalaId || item.kepalaSalesId !== kepalaId) return false;
    if (filter === "SEMUA") return true;
    if (filter === "BELUM_TERUKUR") return item.predikat === null;
    return item.predikat === filter;
  });
}

/** Jumlah anggota per predikat — angka di chip filter. */
export function hitungPerPredikat(
  sales: readonly PenilaianSales[],
  kepalaId: string,
): Record<FilterPredikat, number> {
  const hasil: Record<FilterPredikat, number> = {
    SEMUA: 0,
    SANGAT_BAIK: 0,
    BAIK: 0,
    CUKUP: 0,
    PERLU_PEMBINAAN: 0,
    BELUM_TERUKUR: 0,
  };
  for (const item of anggotaTim(sales, kepalaId, "SEMUA")) {
    hasil.SEMUA += 1;
    hasil[item.predikat ?? "BELUM_TERUKUR"] += 1;
  }
  return hasil;
}
