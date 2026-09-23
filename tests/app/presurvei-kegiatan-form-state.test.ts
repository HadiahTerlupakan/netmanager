import { describe, expect, it } from "vitest";

import {
  keKesalahanForm,
  keMuatanKegiatan,
  KUNCI_KESALAHAN_FORM,
  NILAI_FORM_KOSONG,
  type NilaiFormKegiatan,
} from "@/app/admin/presurvei/kegiatan/kegiatanFormState";
import { KEGIATAN_JENIS } from "@/modules/presurvei/client";

const nilai: NilaiFormKegiatan = {
  jenis: "SURVEI_LOKASI",
  hasil: "TERTARIK",
  waktuMulai: "2026-09-10T09:00",
  alamatDikunjungi: "Jl. Merdeka 10",
  ditemuiNama: "Budi",
  catatan: "",
  prospekId: "",
  iklanId: "",
};

describe("keMuatanKegiatan", () => {
  it("mengirim null untuk medan opsional yang dikosongkan", () => {
    const muatan = keMuatanKegiatan({
      ...nilai,
      catatan: "",
      prospekId: "",
      iklanId: "",
    });

    expect(muatan.catatan).toBeNull();
    expect(muatan.prospekId).toBeNull();
    expect(muatan.iklanId).toBeNull();
  });

  it("tidak pernah mengirim koordinat maupun foto", () => {
    // Keduanya lahir dari perangkat di lapangan. Mengirimnya dari web akan
    // menempatkan penanda palsu di peta kunjungan.
    const muatan = keMuatanKegiatan(nilai) as Record<string, unknown>;

    expect(muatan).not.toHaveProperty("latitude");
    expect(muatan).not.toHaveProperty("longitude");
    expect(muatan).not.toHaveProperty("fotoUrls");
  });

  it("tidak pernah membawa data teknis survei, untuk jenis apa pun", () => {
    // Data teknis hanya diterima pada survei lokasi (refine kedua,
    // `modules/presurvei/validators/kegiatan.validator.ts:94-101`), dan survei
    // lokasi selalu ditolak dari web karena tak berkoordinat (refine pertama,
    // baris 88-93). Form web karenanya tidak punya medan data teknis sama
    // sekali — termasuk untuk SURVEI_LOKASI.
    for (const jenis of KEGIATAN_JENIS) {
      const muatan = keMuatanKegiatan({ ...nilai, jenis }) as Record<
        string,
        unknown
      >;

      expect(muatan, jenis).not.toHaveProperty("odpTerdekat");
      expect(muatan, jenis).not.toHaveProperty("estimasiKabelMeter");
      expect(muatan, jenis).not.toHaveProperty("catatanTeknis");
    }
  });

  it("mengubah waktu mulai menjadi instan absolut ber-Z", () => {
    // Bergantung pada pemakuan TZ ke Asia/Jakarta di `tests/setup.ts:5` —
    // sama seperti test tanggal lain di fase ini. Bentuk date-time tanpa
    // offset diurai sebagai waktu LOKAL, jadi 09:00 WIB adalah 02:00Z. Tanpa
    // pemakuan itu angkanya bergeser mengikuti mesin yang menjalankan test.
    expect(keMuatanKegiatan(nilai).waktuMulai).toBe("2026-09-10T02:00:00.000Z");
  });

  it("tidak melempar saat waktu mulai kosong atau tak terurai", () => {
    // `new Date("").toISOString()` melempar RangeError. Kalau itu terjadi saat
    // membentuk muatan, modal roboh sebelum Zod sempat memberi pesan.
    expect(() => keMuatanKegiatan({ ...nilai, waktuMulai: "" })).not.toThrow();
    expect(keMuatanKegiatan({ ...nilai, waktuMulai: "" }).waktuMulai).toBe("");
    expect(
      keMuatanKegiatan({ ...nilai, waktuMulai: "bukan tanggal" }).waktuMulai,
    ).toBe("bukan tanggal");
  });
});

describe("keMuatanKegiatan terhadap catatKegiatanSchema", () => {
  it("diterima dari nilai awal form begitu waktu mulai diisi", async () => {
    // Menjaga default `jenis` di `NILAI_FORM_KOSONG`. Membuka modal pada jenis
    // lapangan (KUNJUNGAN atau SURVEI_LOKASI) berarti menyodorkan form yang
    // pasti ditolak sebelum pemakai mengetik apa pun.
    const { catatKegiatanSchema } = await import("@/modules/presurvei/client");

    const hasil = catatKegiatanSchema.safeParse(
      keMuatanKegiatan({
        ...NILAI_FORM_KOSONG,
        waktuMulai: "2026-09-10T09:00",
      }),
    );

    expect(hasil.success).toBe(true);
  });

  it("diterima untuk jenis yang memang dicatat dari kantor", async () => {
    const { catatKegiatanSchema } = await import("@/modules/presurvei/client");

    for (const contoh of [
      { jenis: "TELEPON", iklanId: "" },
      { jenis: "CHAT", iklanId: "" },
      { jenis: "IKLAN", iklanId: "iklan-1" },
    ] as const) {
      const hasil = catatKegiatanSchema.safeParse(
        keMuatanKegiatan({ ...nilai, ...contoh }),
      );

      expect(hasil.success, `${contoh.jenis} seharusnya diterima`).toBe(true);
    }
  });

  it("ditolak untuk jenis lapangan, karena web tidak menangkap koordinat", async () => {
    // Bukan "tersimpan tapi tanpa titik di peta" — schema menolaknya mentah di
    // refine pertama (`modules/presurvei/validators/kegiatan.validator.ts:88-93`),
    // jadi kunjungan dan survei lokasi TIDAK BISA dicatat dari web sama sekali.
    // Keduanya memang milik aplikasi lapangan; modal hanya perlu mengatakannya
    // sebelum pemakai mengetik.
    const { catatKegiatanSchema } = await import("@/modules/presurvei/client");

    for (const jenis of ["KUNJUNGAN", "SURVEI_LOKASI"] as const) {
      const hasil = catatKegiatanSchema.safeParse(
        keMuatanKegiatan({ ...nilai, jenis }),
      );

      expect(hasil.success, `${jenis} seharusnya ditolak`).toBe(false);
      expect(hasil.error?.issues.map((issue) => issue.message)).toContain(
        "Kunjungan dan survei lokasi wajib menyertakan koordinat",
      );
    }
  });

  it("menolak iklan tanpa kampanye yang ditunjuk", async () => {
    const { catatKegiatanSchema } = await import("@/modules/presurvei/client");

    const hasil = catatKegiatanSchema.safeParse(
      keMuatanKegiatan({ ...nilai, jenis: "IKLAN", iklanId: "" }),
    );

    expect(hasil.success).toBe(false);
    expect(hasil.error?.issues.map((issue) => issue.message)).toContain(
      "Kegiatan iklan wajib menunjuk ke sebuah iklan",
    );
  });
});

describe("keKesalahanForm", () => {
  it("menaruh pesan level-akar di slot pesan form", () => {
    // Ketiga `.refine()` schema berpath kosong. Tanpa pengalihan ini pemakai
    // menekan Simpan, form menolak, dan layar tidak memberi tahu apa pun.
    const kesalahan = keKesalahanForm([
      {
        path: [],
        message: "Kunjungan dan survei lokasi wajib menyertakan koordinat",
      },
    ]);

    expect(kesalahan[KUNCI_KESALAHAN_FORM]).toBe(
      "Kunjungan dan survei lokasi wajib menyertakan koordinat",
    );
  });

  it("menaruh pesan medan tak berslot di slot pesan form", () => {
    // `latitude` divalidasi schema tapi tidak punya medan di form ini.
    const kesalahan = keKesalahanForm([
      { path: ["latitude"], message: "Koordinat tidak sah" },
    ]);

    expect(kesalahan[KUNCI_KESALAHAN_FORM]).toBe("Koordinat tidak sah");
  });

  it("menaruh pesan medan berslot di medannya sendiri", () => {
    const kesalahan = keKesalahanForm([
      { path: ["waktuMulai"], message: "Waktu mulai tidak sah" },
      { path: ["ditemuiNama"], message: "Nama terlalu panjang" },
    ]);

    expect(kesalahan.waktuMulai).toBe("Waktu mulai tidak sah");
    expect(kesalahan.ditemuiNama).toBe("Nama terlalu panjang");
    expect(kesalahan[KUNCI_KESALAHAN_FORM]).toBeUndefined();
  });
});
