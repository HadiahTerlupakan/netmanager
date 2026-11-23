/**
 * Efek opname terhadap kolom stok per kondisi (baru/bekas/rusak).
 *
 * Murni: tidak menyentuh basis data, jadi aturan yang sama dipakai saat opname
 * dibuat, diubah, dan dihapus — dan bisa diuji tanpa basis data.
 */

export type KondisiStok = "BARU" | "BEKAS" | "RUSAK";

/** Kolom stok satu barang di satu gudang. `stok` adalah total semua kondisi. */
export interface StokPerKondisi {
  stok: number;
  stokBaru: number;
  stokBekas: number;
  stokRusak: number;
}

type KolomKondisi = "stokBaru" | "stokBekas" | "stokRusak";

const KOLOM_PER_KONDISI: Record<KondisiStok, KolomKondisi> = {
  BARU: "stokBaru",
  BEKAS: "stokBekas",
  RUSAK: "stokRusak",
};

/** Urutan kolom yang dipotong bila kolom kondisi utama tidak cukup. */
const URUTAN_POTONG_CADANGAN: readonly KondisiStok[] = [
  "BARU",
  "BEKAS",
  "RUSAK",
];

/** Stok kosong; titik awal bila barang belum punya baris stok di gudang. */
export const STOK_KOSONG: StokPerKondisi = Object.freeze({
  stok: 0,
  stokBaru: 0,
  stokBekas: 0,
  stokRusak: 0,
});

/**
 * Terapkan perubahan jumlah pada satu kondisi.
 *
 * Positif menambah kolom kondisi itu dan total. Negatif memotong kolom kondisi
 * itu dulu; sisanya diambil dari kolom lain berurutan BARU, BEKAS, RUSAK. Tidak
 * ada kolom yang turun di bawah 0, dan total = max(0, stok + delta).
 */
export function applyConditionDelta(
  stock: StokPerKondisi,
  kondisi: KondisiStok,
  delta: number,
): StokPerKondisi {
  // Hanya empat kolom stok yang disalin: baris basis data bisa membawa field
  // lain yang tidak boleh ikut tertulis ulang.
  const next: StokPerKondisi = {
    stok: Math.max(0, stock.stok + delta),
    stokBaru: stock.stokBaru,
    stokBekas: stock.stokBekas,
    stokRusak: stock.stokRusak,
  };
  const kolomUtama = KOLOM_PER_KONDISI[kondisi];

  if (delta >= 0) {
    next[kolomUtama] = stock[kolomUtama] + delta;
    return next;
  }

  let sisaPotong = potongKolom(next, kolomUtama, -delta);
  for (const cadangan of URUTAN_POTONG_CADANGAN) {
    if (sisaPotong === 0) break;
    if (cadangan === kondisi) continue;
    sisaPotong = potongKolom(next, KOLOM_PER_KONDISI[cadangan], sisaPotong);
  }
  return next;
}

/** Potong sebanyak mungkin dari satu kolom (tidak sampai minus); kembalikan sisa yang belum terpotong. */
function potongKolom(
  stock: StokPerKondisi,
  kolom: KolomKondisi,
  jumlah: number,
): number {
  const tersedia = Math.max(0, stock[kolom]);
  const terpotong = Math.min(tersedia, jumlah);
  stock[kolom] = tersedia - terpotong;
  return jumlah - terpotong;
}

/**
 * Perubahan kolom per kondisi yang benar-benar diterapkan sebuah opname.
 * Disimpan di catatan opname supaya edit/hapus bisa membaliknya persis,
 * termasuk bagian yang dipotong dari kolom cadangan.
 */
export interface EfekStokOpname {
  stokBaru: number;
  stokBekas: number;
  stokRusak: number;
}

/** Hitung efek per kondisi dari kolom stok sebelum dan sesudah opname. */
export function computeStockEffect(
  sebelum: StokPerKondisi,
  sesudah: StokPerKondisi,
): EfekStokOpname {
  return {
    stokBaru: sesudah.stokBaru - sebelum.stokBaru,
    stokBekas: sesudah.stokBekas - sebelum.stokBekas,
    stokRusak: sesudah.stokRusak - sebelum.stokRusak,
  };
}

const KONDISI_PER_KOLOM: ReadonlyArray<[KolomKondisi, KondisiStok]> = [
  ["stokBaru", "BARU"],
  ["stokBekas", "BEKAS"],
  ["stokRusak", "RUSAK"],
];

/**
 * Batalkan efek sebuah opname pada stok.
 *
 * Opname dengan efek tersimpan dibalik per kolom persis seperti diterapkan:
 * pengembalian dulu, baru pemotongan, agar pemotongan bisa memakai unit yang
 * baru dikembalikan. Opname lama tanpa efek tersimpan dulu selalu mengubah
 * stokBaru sebesar selisih, jadi dibalik dengan cara yang sama.
 */
export function reverseOpnameStockEffect(
  stock: StokPerKondisi,
  opname: { selisih: number; efek: EfekStokOpname | null },
): StokPerKondisi {
  const { efek } = opname;
  if (!efek) return applyConditionDelta(stock, "BARU", -opname.selisih);

  const dikembalikan = KONDISI_PER_KOLOM.reduce(
    (current, [kolom, kondisi]) =>
      efek[kolom] < 0
        ? applyConditionDelta(current, kondisi, -efek[kolom])
        : current,
    stock,
  );
  return KONDISI_PER_KOLOM.reduce(
    (current, [kolom, kondisi]) =>
      efek[kolom] > 0
        ? applyConditionDelta(current, kondisi, -efek[kolom])
        : current,
    dikembalikan,
  );
}

/** Baca efek tersimpan dari catatan opname; null bila opname lama. */
export function readStoredStockEffect(record: {
  efekStokBaru: number | null;
  efekStokBekas: number | null;
  efekStokRusak: number | null;
}): EfekStokOpname | null {
  if (
    record.efekStokBaru == null ||
    record.efekStokBekas == null ||
    record.efekStokRusak == null
  ) {
    return null;
  }
  return {
    stokBaru: record.efekStokBaru,
    stokBekas: record.efekStokBekas,
    stokRusak: record.efekStokRusak,
  };
}

/** Ubah efek menjadi field kolom catatan opname untuk disimpan. */
export function toStoredStockEffect(efek: EfekStokOpname) {
  return {
    efekStokBaru: efek.stokBaru,
    efekStokBekas: efek.stokBekas,
    efekStokRusak: efek.stokRusak,
  };
}
