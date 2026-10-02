import {
  TAMPILAN_STATUS_SO,
  URUTAN_PRIORITAS_STATUS_SO,
  type KepatuhanGudang,
  type LaporanKepatuhanSo,
  type StatusSoGudang,
} from "./jadwalSoTypes";

/** Ikon teks per status (dropdown native tidak bisa diberi warna). */
const IKON_STATUS: Record<StatusSoGudang, string> = {
  LENGKAP: "✓",
  SEBAGIAN: "◐",
  DI_LUAR_JADWAL: "!",
  BELUM: "✗",
  TANPA_STOK: "–",
};

/** Keterangan ikon status: "✓ Lengkap · ◐ Sebagian · … · – Tidak ada stok". */
export const LEGENDA_STATUS_SO = (Object.keys(IKON_STATUS) as StatusSoGudang[])
  .map((status) => `${IKON_STATUS[status]} ${TAMPILAN_STATUS_SO[status].label}`)
  .join(" · ");

/**
 * Status SO bulan ini per gudang (map gudangId → gudang dengan status terburuk).
 * Gudang yang dipakai beberapa site dinilai per site; diambil status terburuknya.
 */
export function statusSoPerGudang(laporan: LaporanKepatuhanSo | undefined): Map<string, KepatuhanGudang> {
  const hasil = new Map<string, KepatuhanGudang>();
  for (const gudang of laporan?.site.flatMap((site) => site.gudang) ?? []) {
    const sebelumnya = hasil.get(gudang.id);
    if (!sebelumnya || URUTAN_PRIORITAS_STATUS_SO.indexOf(gudang.status) < URUTAN_PRIORITAS_STATUS_SO.indexOf(sebelumnya.status)) {
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
