import { describe, expect, it } from "vitest";

import {
  blokYangTampil,
  teksEstimasiKabel,
  teksRentangWaktu,
} from "@/app/admin/presurvei/kegiatan/[id]/blokDetail";
import { keTitikPeta } from "@/app/admin/presurvei/kegiatan/titikPeta";
import type { KegiatanDetailDto } from "@/modules/presurvei/client";

const detail = (over: Partial<KegiatanDetailDto>): KegiatanDetailDto =>
  ({
    id: "kegiatan-1",
    jenis: "SURVEI_LOKASI",
    userId: "sales-1",
    prospekId: "prospek-1",
    waktuMulai: "2026-09-10T02:00:00.000Z",
    waktuSelesai: null,
    alamatDikunjungi: "Jl. Merdeka 10",
    ditemuiNama: "Budi",
    hasil: "TERTARIK",
    jumlahFoto: 0,
    latitude: null,
    longitude: null,
    iklanId: null,
    catatan: null,
    fotoUrls: [],
    dataTeknis: null,
    createdAt: "2026-09-10T02:00:00.000Z",
    ...over,
  }) as KegiatanDetailDto;

describe("blokYangTampil", () => {
  it("menyembunyikan ketiga blok saat tidak ada isinya", () => {
    const blok = blokYangTampil(detail({}));

    expect(blok).toEqual({ foto: false, dataTeknis: false, peta: false });
  });

  it("menampilkan peta hanya bila kedua koordinat ada", () => {
    // Satu koordinat tanpa pasangannya tidak bisa digambar, dan menampilkan
    // peta kosong lebih membingungkan daripada tidak menampilkannya.
    expect(blokYangTampil(detail({ latitude: -6.2 })).peta).toBe(false);
    expect(
      blokYangTampil(detail({ latitude: -6.2, longitude: 106.8 })).peta,
    ).toBe(true);
  });

  it("menampilkan peta untuk koordinat nol", () => {
    // Lintang 0 melintasi Indonesia. Pemeriksaan truthiness akan menyembunyikan
    // peta untuk survei di Pontianak.
    expect(blokYangTampil(detail({ latitude: 0, longitude: 109.3 })).peta).toBe(
      true,
    );
  });

  it("menampilkan blok data teknis saat ada isinya", () => {
    expect(
      blokYangTampil(
        detail({
          dataTeknis: {
            odpTerdekat: "ODP-12",
            estimasiKabelMeter: 0,
            catatanTeknis: null,
          },
        }),
      ).dataTeknis,
    ).toBe(true);
  });

  it("menampilkan galeri hanya bila ada foto", () => {
    expect(blokYangTampil(detail({ fotoUrls: [] })).foto).toBe(false);
    expect(blokYangTampil(detail({ fotoUrls: ["a.jpg"] })).foto).toBe(true);
  });

  it("sepakat dengan keTitikPeta tentang kegiatan mana yang punya titik", () => {
    // Kedua berkas memutuskan hal yang sama dengan perbandingan null-nya
    // masing-masing, dan halaman detail memakai keduanya sekaligus: blok
    // ditampilkan oleh `blokYangTampil`, isinya dirakit `keTitikPeta`.
    // Kalau keduanya menyimpang, blok peta tampil berisi NOL penanda — peta
    // kosong tanpa satu pun pesan, persis cara gagal yang blok ini dibuat
    // untuk mencegah. Tak satu pun test di kedua berkas menjaga kesepakatan
    // ini, karena masing-masing hanya melihat separuhnya.
    const kasus = [
      detail({ latitude: null, longitude: null }),
      detail({ latitude: -6.2, longitude: null }),
      detail({ latitude: null, longitude: 106.8 }),
      detail({ latitude: 0, longitude: 109.3 }),
      detail({ latitude: -6.2, longitude: 106.8 }),
    ];

    for (const kegiatan of kasus) {
      expect(blokYangTampil(kegiatan).peta).toBe(
        keTitikPeta([kegiatan]).titik.length > 0,
      );
    }
  });
});

describe("teksRentangWaktu", () => {
  // Kedua assertion di bawah bergantung pada pemakuan `process.env.TZ =
  // "Asia/Jakarta"` di `tests/setup.ts`. Tanpa itu jamnya bergeser mengikuti
  // mesin yang menjalankannya — bukan bug di kode produksi.

  it("memformat kedua ujung rentang, dalam urutan mulai lalu selesai", () => {
    // Jam keduanya sengaja berbeda: `waktuMulai` dan `waktuSelesai`
    // bersebelahan, sama-sama `string`, dan menukarnya lolos `tsc` tanpa
    // keluhan — dengan jam yang sama tertukarnya tidak terlihat sama sekali.
    const teks = teksRentangWaktu(
      detail({
        waktuMulai: "2026-09-10T02:00:00.000Z",
        waktuSelesai: "2026-09-10T03:30:00.000Z",
      }),
    );

    expect(teks).toBe("10 Sep 2026 09:00 – 10 Sep 2026 10:30");
  });

  it("menyebut kegiatan yang belum ditutup alih-alih mencetak strip", () => {
    // `formatDateTimeDisplay(null)` mengembalikan "-", yang tidak bisa
    // dibedakan dari tanggal rusak. Kegiatan yang masih berjalan adalah
    // keadaan normal di lapangan dan layak kalimatnya sendiri.
    const teks = teksRentangWaktu(detail({ waktuSelesai: null }));

    expect(teks).toBe("10 Sep 2026 09:00 – belum selesai");
  });

  it("tidak pernah mencetak ISO mentah", () => {
    // Nilai DTO adalah hasil `toISOString()`. Meneruskannya apa adanya ke
    // layar adalah cacat yang sudah terjadi di layar daftar fase ini.
    expect(teksRentangWaktu(detail({}))).not.toContain("T02:00:00");
  });
});

describe("teksEstimasiKabel", () => {
  it("mencetak estimasi nol meter, bukan menyembunyikannya", () => {
    // Nol meter adalah hasil survei yang sah — tiang ada tepat di depan
    // rumahnya. `meter ? ... : "-"` melaporkannya sebagai tidak diukur, dan
    // jebakan falsy yang sama sudah pernah diperingatkan di `kegiatan.dto.ts`
    // untuk field ini persis.
    expect(teksEstimasiKabel(0)).toBe("0 m");
  });

  it("menyertakan satuan pada estimasi yang terisi", () => {
    expect(teksEstimasiKabel(45)).toBe("45 m");
  });

  it("menandai estimasi yang memang belum diukur", () => {
    expect(teksEstimasiKabel(null)).toBe("-");
  });
});
