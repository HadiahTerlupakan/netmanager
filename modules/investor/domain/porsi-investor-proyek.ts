/**
 * Porsi seorang investor di satu proyek RAB. Persen bagi hasil di RAB adalah
 * bagian SEMUA investor proyek itu; tiap investor mendapat bagian sesuai
 * porsi modalnya. Fungsi murni — dipakai portal & perhitungan bagi hasil.
 */

/** Status RAB yang boleh dilihat investor: sudah disetujui dan berjalan/selesai. */
export const STATUS_PROYEK_TERLIHAT_INVESTOR = [
  "APPROVED",
  "PENGADAAN",
  "PENGGELARAN_JARINGAN",
  "PENJUALAN",
  "IN_PROGRESS",
  "COMPLETED",
] as const;

const PERSEN_PENUH = 100;
const DESIMAL_PERSEN = 100;

type Nominal = bigint | number | string | { toString(): string };

const keAngka = (nilai: Nominal) => Number(nilai.toString());

/**
 * Porsi modal investor (0–1) terhadap seluruh modal investor proyek. Bila
 * total modal nol (RAB belum berbiaya), porsi dibagi rata.
 */
export function hitungPorsiModal(modalInvestor: Nominal, semuaModal: readonly Nominal[]): number {
  if (semuaModal.length === 0) return 0;
  const total = semuaModal.reduce<number>((jumlah, modal) => jumlah + keAngka(modal), 0);
  if (total <= 0) return 1 / semuaModal.length;
  return keAngka(modalInvestor) / total;
}

/** Persen bagi hasil milik satu investor, dibulatkan dua desimal. */
export function persenBagiHasilInvestor(persenSemuaInvestor: number, porsiModal: number): number {
  const persen = Math.min(persenSemuaInvestor, PERSEN_PENUH) * porsiModal;
  return Math.round(persen * DESIMAL_PERSEN) / DESIMAL_PERSEN;
}
