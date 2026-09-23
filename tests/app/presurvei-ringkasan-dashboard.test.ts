import { describe, expect, it, vi } from "vitest";

import {
  buildKegiatanTerbaruUrl,
  buildProspekTakBertuanUrl,
  hitungCorong,
  ringkasHasilKolom,
  tanggalAwalKegiatan,
  teksJumlahKartu,
  tentukanBagianDashboard,
  type KartuCorong,
} from "@/app/admin/presurvei/ringkasanDashboard";

describe("hitungCorong", () => {
  it("menyusun kartu untuk tiap kolom hidup, berurutan", () => {
    const kartu = hitungCorong({
      BARU: 12,
      DIHUBUNGI: 7,
      TERTARIK: 4,
      NEGOSIASI: 2,
      DEAL: 1,
    });

    expect(kartu.map((k) => k.status)).toEqual([
      "BARU",
      "DIHUBUNGI",
      "TERTARIK",
      "NEGOSIASI",
      "DEAL",
    ]);
    // Nilai berbeda-beda: jumlah yang tertukar antar-kolom tetap terlihat.
    expect(kartu.map((k) => k.jumlah)).toEqual([12, 7, 4, 2, 1]);
  });

  it("menampilkan nol untuk status yang tidak punya prospek", () => {
    // Status yang hilang dari respons berarti nol, bukan tidak ada. Kartu
    // yang menghilang membuat corongnya tampak lebih pendek dari kenyataan.
    const kartu = hitungCorong({ BARU: 3 });

    expect(kartu).toHaveLength(5);
    expect(kartu.find((k) => k.status === "DEAL")?.jumlah).toBe(0);
  });

  it("tidak memasukkan status mati ke corong", () => {
    // TIDAK_MINAT dan TIDAK_LAYAK tumbuh tanpa batas; memasukkannya membuat
    // kartu corong didominasi prospek yang sudah tidak digarap.
    const kartu = hitungCorong({ BARU: 3, TIDAK_MINAT: 99, TIDAK_LAYAK: 50 });

    expect(kartu.map((k) => k.status)).not.toContain("TIDAK_MINAT");
    expect(kartu.map((k) => k.status)).not.toContain("TIDAK_LAYAK");
  });

  it("memakai label dari konfigurasi status", () => {
    expect(hitungCorong({ BARU: 1 })[0].label).toBe("Baru");
  });

  it("membedakan kolom yang gagal dimuat dari kolom kosong", () => {
    // Gagal ≠ nol: kartu bernilai 0 untuk kolom yang ditolak server membuat
    // pemakai menyimpulkan tahap itu memang kosong.
    const kartu = hitungCorong({ BARU: 3 }, { DIHUBUNGI: "gagal" });

    const dihubungi = kartu.find((k) => k.status === "DIHUBUNGI");
    expect(dihubungi).toEqual({
      status: "DIHUBUNGI",
      label: "Dihubungi",
      warna: "bg-blue-100 text-blue-700",
      jumlah: null,
      keadaan: "gagal",
    });
    expect(kartu.find((k) => k.status === "BARU")).toMatchObject({
      jumlah: 3,
      keadaan: "termuat",
    });
  });

  it("menandai kolom yang masih dimuat tanpa angka", () => {
    const kartu = hitungCorong({}, { TERTARIK: "memuat" });

    expect(kartu.find((k) => k.status === "TERTARIK")).toMatchObject({
      jumlah: null,
      keadaan: "memuat",
    });
  });
});

describe("ringkasHasilKolom", () => {
  it("memisahkan jumlah termuat dari kolom gagal dan kolom yang masih dimuat", () => {
    const ringkasan = ringkasHasilKolom([
      { status: "BARU", total: 12, isGagal: false },
      { status: "DIHUBUNGI", total: undefined, isGagal: true },
      { status: "TERTARIK", total: undefined, isGagal: false },
      { status: "NEGOSIASI", total: 0, isGagal: false },
    ]);

    expect(ringkasan).toEqual({
      jumlahPerStatus: { BARU: 12, NEGOSIASI: 0 },
      keadaanTakTermuat: { DIHUBUNGI: "gagal", TERTARIK: "memuat" },
    });
  });

  it("menganggap gagal kolom yang punya angka lama tapi muat ulangnya ditolak", () => {
    // React Query mempertahankan data lama bersama error; angka lama itu bisa
    // sudah tidak benar setelah kartu dipindahkan, jadi tidak ditampilkan.
    const ringkasan = ringkasHasilKolom([
      { status: "DEAL", total: 4, isGagal: true },
    ]);

    expect(ringkasan).toEqual({
      jumlahPerStatus: {},
      keadaanTakTermuat: { DEAL: "gagal" },
    });
  });
});

describe("teksJumlahKartu", () => {
  const kartuDasar: KartuCorong = {
    status: "BARU",
    label: "Baru",
    warna: "bg-slate-100 text-slate-700",
    jumlah: 0,
    keadaan: "termuat",
  };

  it("mencetak nol sebagai angka, bukan tanda gagal", () => {
    expect(teksJumlahKartu(kartuDasar)).toBe("0");
  });

  it("mencetak tanda pisah untuk kolom gagal", () => {
    expect(
      teksJumlahKartu({ ...kartuDasar, jumlah: null, keadaan: "gagal" }),
    ).toBe("—");
  });

  it("mencetak elipsis untuk kolom yang masih dimuat", () => {
    expect(
      teksJumlahKartu({ ...kartuDasar, jumlah: null, keadaan: "memuat" }),
    ).toBe("…");
  });
});

describe("tentukanBagianDashboard", () => {
  const izinDari =
    (dimiliki: string[]) =>
    (izin: string): boolean =>
      dimiliki.includes(izin);

  it("memberi sales lapangan corong miliknya saja, tanpa laporan dan tanpa prospek tak bertuan", () => {
    const bagian = tentukanBagianDashboard(izinDari(["m_presurvei:read"]));

    expect(bagian).toEqual({
      judulCorong: "Prospek Anda",
      judulKegiatan: "Kegiatan Anda",
      canLihatTakBertuan: false,
      canLihatLaporan: false,
    });
  });

  it("memberi pemegang izin web cakupan tenant dan daftar tak bertuan", () => {
    const bagian = tentukanBagianDashboard(izinDari(["presurvei:read"]));

    expect(bagian).toEqual({
      judulCorong: "Prospek tenant",
      judulKegiatan: "Kegiatan tenant",
      canLihatTakBertuan: true,
      canLihatLaporan: false,
    });
  });

  it("menampilkan ringkasan pencapaian hanya untuk pemegang izin laporan", () => {
    // Endpoint laporan menuntut `presurvei_laporan:read`
    // (`app/api/admin/presurvei/laporan/route.ts:13`); tanpa izin itu bagian
    // ini hanya menghasilkan 403 dan toast gagal di setiap buka.
    const bagian = tentukanBagianDashboard(
      izinDari(["m_presurvei:read", "presurvei_laporan:read"]),
    );

    expect(bagian.canLihatLaporan).toBe(true);
    expect(bagian.canLihatTakBertuan).toBe(false);
  });

  it("menanyakan izin dengan nama yang dipakai route", () => {
    const punyaIzin = vi.fn(() => false);

    tentukanBagianDashboard(punyaIzin);

    expect(punyaIzin).toHaveBeenCalledWith("presurvei:read");
    expect(punyaIzin).toHaveBeenCalledWith("presurvei_laporan:read");
  });
});

describe("rentang kegiatan terbaru", () => {
  it("mulai dari awal hari UTC enam hari sebelum hari ini", () => {
    // Hari ini ikut dihitung, jadi tujuh hari kalender UTC: 17..23 September.
    expect(tanggalAwalKegiatan(new Date("2026-09-23T10:15:00.000Z"))).toBe(
      "2026-09-17",
    );
  });

  it("memakai tanggal UTC, bukan tanggal lokal", () => {
    // 23 September 05:00 WIB masih 22 September di UTC.
    expect(tanggalAwalKegiatan(new Date("2026-09-22T22:00:00.000Z"))).toBe(
      "2026-09-16",
    );
  });

  it("melintasi batas bulan dengan benar", () => {
    expect(tanggalAwalKegiatan(new Date("2026-10-03T00:00:00.000Z"))).toBe(
      "2026-09-27",
    );
  });

  it("membentuk URL kegiatan berbatas dengan nama param milik route", () => {
    // Nama param dicocokkan ke `app/api/presurvei/kegiatan/route.ts:21-28`.
    const url = new URL(
      buildKegiatanTerbaruUrl(new Date("2026-09-23T10:15:00.000Z")),
      "http://localhost",
    );

    expect(url.pathname).toBe("/api/presurvei/kegiatan");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: "1",
      limit: "5",
      dariTanggal: "2026-09-17",
    });
  });
});

describe("buildProspekTakBertuanUrl", () => {
  it("meminta halaman pertama prospek tak bertuan dengan batas kecil", () => {
    const url = new URL(buildProspekTakBertuanUrl(), "http://localhost");

    expect(url.pathname).toBe("/api/presurvei/prospek");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      tanpaPemilik: "true",
      page: "1",
      limit: "5",
    });
  });
});
