export const DEFAULT_PAGE_SIZE = 10;
export const SEARCH_DEBOUNCE_MS = 500;
export const INVOICE_FETCH_DELAY_MS = 500;
export const INVOICE_FETCH_CHUNK_SIZE = 1;
export const MIXRADIUS_SOURCE_LABEL = "sblnet.topsetting.com";

export const DISMANTLE_REASONS = [
  "Telat Bayar",
  "Pindah Rumah",
  "Pindah ke Provider Lain",
  "Sering Gangguan",
  "Pelayanan Pelanggan Buruk",
  "Kebutuhan Menurun",
  "Harga Terlalu Mahal",
  "Kecepatan Tidak Sesuai Janji",
  "Tidak Ada Keterangan",
] as const;
