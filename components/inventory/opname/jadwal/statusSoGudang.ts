import {
  TAMPILAN_STATUS_SO,
  type KepatuhanGudang,
  type LaporanKepatuhanSo,
  type StatusSoGudang,
} from "./jadwalSoTypes";

/**
 * Urutan dari yang paling perlu ditindaklanjuti. Gudang yang dipakai beberapa
 * site dinilai per site; untuk satu penanda diambil status terburuknya.
 */
const PRIORITAS_STATUS: StatusSoGudang[] = ["BELUM", "DI_LUAR_JADWAL", "SEBAGIAN", "LENGKAP", "TANPA_STOK"];

/** Ikon teks per status (dropdown native tidak bisa diberi warna). */
const IKON_STATUS: Record<StatusSoGudang, string> = {
  LENGKAP: "✓",
  SEBAGIAN: "◐",
  DI_LUAR_JADWAL: "!",
  BELUM: "✗",
  TANPA_STOK: "–",
};

/** Status SO bulan ini per gudang (map gudangId → gudang dengan status terburuk). */
export function statusSoPerGudang(laporan: LaporanKepatuhanSo | undefined): Map<string, KepatuhanGudang> {
  const hasil = new Map<string, KepatuhanGudang>();
  for (const gudang of laporan?.site.flatMap((site) => site.gudang) ?? []) {
    const sebelumnya = hasil.get(gudang.id);
    if (!sebelumnya || PRIORITAS_STATUS.indexOf(gudang.status) < PRIORITAS_STATUS.indexOf(sebelumnya.status)) {
      hasil.set(gudang.id, gudang);
    }
  }
  return hasil;
}

/** "✗ Belum SO" / "◐ Sebagian 2/5" untuk sebuah gudang. */
export function labelStatusSoGudang(gudang: KepatuhanGudang): string {
  const label = `${IKON_STATUS[gudang.status]} ${TAMPILAN_STATUS_SO[gudang.status].label}`;
  return gudang.status === "SEBAGIAN"
    ? `${label} ${gudang.jumlahDihitungDalamJadwal}/${gudang.jumlahBarangBerstok}`
    : label;
}
