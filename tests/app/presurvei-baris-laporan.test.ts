import { describe, expect, it } from "vitest";

import {
  keBarisTampilan,
  pesanLaporanKosong,
} from "@/app/admin/presurvei/laporan/barisLaporan";
import type {
  BarisLaporanDto,
  SalesPresurveiDto,
} from "@/modules/presurvei/client";

const DAFTAR_SALES: readonly SalesPresurveiDto[] = Object.freeze([
  { id: "sales-1", nama: "Rina" },
]);

const baris = (over: Partial<BarisLaporanDto>): BarisLaporanDto =>
  ({
    userId: "sales-1",
    periodeTahun: 2026,
    periodeBulan: 9,
    kunjungan: { target: 20, tercapai: 10, persen: 50 },
    prospek: { target: 10, tercapai: 5, persen: 50 },
    konversi: { target: 5, tercapai: 1, persen: 20 },
    ...over,
  }) as BarisLaporanDto;

describe("keBarisTampilan", () => {
  it("membatasi lebar bilah pada 100 tapi menampilkan angka sebenarnya", () => {
    // Manajer perlu melihat 40 kunjungan dari target 20, bukan sekadar "100%".
    // `persen` 150 dipakai supaya batasnya diuji di sini, bukan dipercayakan
    // pada `hitungPersen` di domain.
    const hasil = keBarisTampilan(
      [baris({ kunjungan: { target: 20, tercapai: 40, persen: 150 } })],
      DAFTAR_SALES,
    );

    expect(hasil[0].kunjungan.lebarBilah).toBe(100);
    expect(hasil[0].kunjungan.tercapai).toBe(40);
  });

  it("menandai baris yang seluruh targetnya nol", () => {
    // Target nol dihitung domain sebagai tercapai penuh
    // (`modules/presurvei/domain/target-rules.ts:53-54`). Tanpa penanda, baris
    // itu tampak sebagai sales berkinerja sempurna padahal targetnya memang
    // belum ditetapkan.
    const hasil = keBarisTampilan(
      [
        baris({
          kunjungan: { target: 0, tercapai: 0, persen: 100 },
          prospek: { target: 0, tercapai: 0, persen: 100 },
          konversi: { target: 0, tercapai: 0, persen: 100 },
        }),
      ],
      DAFTAR_SALES,
    );

    expect(hasil[0].isTanpaTarget).toBe(true);
  });

  it("tidak menandai baris yang punya target", () => {
    expect(keBarisTampilan([baris({})], DAFTAR_SALES)[0].isTanpaTarget).toBe(
      false,
    );
  });

  it("memakai tiga metrik yang berbeda, tidak menyalin satu ke lainnya", () => {
    // Ketiganya berbentuk sama dan bersebelahan; tertukarnya tidak ditolak
    // compiler dan menghasilkan laporan yang tampak masuk akal.
    const hasil = keBarisTampilan([baris({})], DAFTAR_SALES)[0];

    expect(hasil.kunjungan.tercapai).toBe(10);
    expect(hasil.prospek.tercapai).toBe(5);
    expect(hasil.konversi.tercapai).toBe(1);
  });

  it("menandai target nol per metrik, bukan hanya per baris", () => {
    // Kunjungan bertarget, konversi tidak. `hitungPersen` memberi konversi
    // 100%, jadi tanpa penanda per metrik bilah konversi tampil PENUH.
    const hasil = keBarisTampilan(
      [baris({ konversi: { target: 0, tercapai: 2, persen: 100 } })],
      DAFTAR_SALES,
    )[0];

    expect(hasil.isTanpaTarget).toBe(false);
    expect(hasil.konversi.isTargetNol).toBe(true);
    expect(hasil.konversi.lebarBilah).toBe(0);
    expect(hasil.kunjungan.isTargetNol).toBe(false);
    expect(hasil.kunjungan.lebarBilah).toBe(50);
  });

  it("tidak menandai baris hanya karena satu atau dua metrik bertarget nol", () => {
    const hasil = keBarisTampilan(
      [
        baris({
          prospek: { target: 0, tercapai: 0, persen: 100 },
          konversi: { target: 0, tercapai: 0, persen: 100 },
        }),
      ],
      DAFTAR_SALES,
    )[0];

    expect(hasil.isTanpaTarget).toBe(false);
  });

  it("menuntut ketiga metrik bertarget nol, bukan hanya kunjungan", () => {
    // Tanpa kasus ini, `isTanpaTarget` yang hanya membaca kunjungan lolos:
    // sales tanpa target kunjungan tapi bertarget konversi disebut "target
    // belum ditetapkan" dan pencapaian konversinya tersembunyi dari manajer.
    const hasil = keBarisTampilan(
      [baris({ kunjungan: { target: 0, tercapai: 3, persen: 100 } })],
      DAFTAR_SALES,
    )[0];

    expect(hasil.isTanpaTarget).toBe(false);
  });

  it("menempelkan label sales dari daftar sales aktif", () => {
    const hasil = keBarisTampilan(
      [baris({}), baris({ userId: "cl000000000000zz9876" })],
      DAFTAR_SALES,
    );

    expect(hasil.map((b) => b.namaSales)).toEqual([
      "Rina",
      "Sales tak tercantum (…zz9876)",
    ]);
  });
});

describe("pesanLaporanKosong", () => {
  it("membedakan gagal memuat dari periode tanpa target", () => {
    // Laporan disusun dari daftar target (`TargetService.ts:52-53`), jadi
    // laporan kosong berarti belum ada target — bukan belum ada kegiatan.
    expect(pesanLaporanKosong(true)).toBe("Laporan gagal dimuat.");
    expect(pesanLaporanKosong(false)).toBe(
      "Belum ada target untuk periode ini.",
    );
  });
});
