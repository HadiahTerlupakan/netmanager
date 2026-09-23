// tests/app/presurvei-prospek-form-state.test.ts
import { describe, expect, it } from "vitest";

import {
  bacaDuplikat,
  denganAbaikanDuplikat,
  keKesalahanForm,
  keMuatanBuatProspek,
  keMuatanUbahProspek,
  keNilaiForm,
  kunciKolomSetelahSimpan,
  KUNCI_KESALAHAN_FORM,
  muatanUntukMode,
  opsiSimpanUntukMode,
  ringkasPilihanKampanye,
  schemaUntukMode,
  type ModeFormProspek,
  type NilaiFormProspek,
} from "@/app/admin/presurvei/prospek/prospekFormState";
import { KUNCI_KOLOM_PROSPEK } from "@/app/admin/presurvei/prospek/prospekKolomQuery";
import {
  buatProspekSchema,
  ubahProspekSchema,
  type IklanListItemDto,
  type ProspekDetailDto,
} from "@/modules/presurvei/client";

const nilai: NilaiFormProspek = {
  nama: "Budi Santoso",
  noTelp: "081234567890",
  email: "",
  alamat: "Jl. Merdeka 10",
  sumber: "WALK_IN",
  iklanId: "",
  referralNama: "",
  paketDiminati: "",
  catatan: "",
};

describe("keMuatanBuatProspek", () => {
  it("mengirim null untuk medan opsional yang dikosongkan", () => {
    const muatan = keMuatanBuatProspek(nilai);

    expect(muatan.email).toBeNull();
    expect(muatan.iklanId).toBeNull();
    expect(muatan.referralNama).toBeNull();
    expect(muatan.paketDiminati).toBeNull();
  });

  it("memangkas spasi pada medan wajib", () => {
    // Nama berspasi di ujung lolos `min(1)` tapi menghasilkan kartu yang
    // tampak rata kiri berbeda dari tetangganya.
    const muatan = keMuatanBuatProspek({ ...nilai, nama: "  Budi  " });

    expect(muatan.nama).toBe("Budi");
  });

  it("mengirim iklanId saat sumbernya IKLAN", () => {
    const muatan = keMuatanBuatProspek({
      ...nilai,
      sumber: "IKLAN",
      iklanId: "iklan-7",
    });

    expect(muatan.sumber).toBe("IKLAN");
    expect(muatan.iklanId).toBe("iklan-7");
  });

  it("lolos validasi schema buat", async () => {
    const { buatProspekSchema } = await import("@/modules/presurvei/client");

    expect(
      buatProspekSchema.safeParse(keMuatanBuatProspek(nilai)).success,
    ).toBe(true);
  });
});

describe("keMuatanUbahProspek", () => {
  it("tidak pernah mengirim pemilikId", () => {
    // Kepemilikan menentukan siapa boleh membaca dan mengubah prospek. Route
    // membuangnya untuk pemanggil tanpa permission web, dan form tidak punya
    // alasan mengirimkannya sama sekali.
    expect(keMuatanUbahProspek(nilai)).not.toHaveProperty("pemilikId");
  });

  it("tidak pernah mengirim status", () => {
    // Status berpindah lewat papan. PATCH sebenarnya AMAN — `ProspekService.ubah()`
    // memanggil `isTransisiStatusSah` dan melempar 409 untuk transisi tak sah —
    // jadi ini bukan soal keamanan melainkan satu jalur: dua tempat yang bisa
    // memindahkan status berarti dua tempat yang harus sepakat soal DEAL, yang
    // menuntut konversi, bukan sekadar ganti status.
    expect(keMuatanUbahProspek(nilai)).not.toHaveProperty("status");
  });
});

// ---------------------------------------------------------------------------
// Test tambahan di luar brief. Test brief saja membiarkan beberapa mutasi
// lolos; tiap blok di bawah menyebut mutasi yang ditangkapnya.
// ---------------------------------------------------------------------------

const MODE_BUAT: ModeFormProspek = { jenis: "buat" };
const MODE_UBAH: ModeFormProspek = { jenis: "ubah", prospekId: "prospek-9" };

/** Semua medan terisi dengan nilai berbeda-beda, supaya tertukarnya terlihat. */
const nilaiLengkap: NilaiFormProspek = Object.freeze({
  nama: "Siti Aminah",
  noTelp: "081299990000",
  email: "siti@contoh.id",
  alamat: "Jl. Kenanga 4",
  sumber: "REFERRAL",
  iklanId: "iklan-lama",
  referralNama: "Pak Joko",
  paketDiminati: "Paket 20 Mbps",
  catatan: "Minta dihubungi sore",
});

describe("keMuatanBuatProspek — medan kosong dan tersembunyi", () => {
  it("menganggap medan berisi spasi saja sebagai kosong", () => {
    // Menangkap mutasi truthiness `teks ? teks.trim() : null`: "   " truthy,
    // jadi mutasi itu mengirim "" alih-alih null. String kosong murni (test
    // brief) tidak bisa membedakannya.
    const muatan = keMuatanBuatProspek({
      ...nilai,
      email: "   ",
      paketDiminati: "  ",
      catatan: " ",
    });

    expect(muatan.email).toBeNull();
    expect(muatan.paketDiminati).toBeNull();
    expect(muatan.catatan).toBeNull();
  });

  it("tidak mengirim iklanId yang tersembunyi saat sumbernya bukan IKLAN", () => {
    // Pemakai memilih kampanye, lalu mengganti sumber. Medan kampanye hilang
    // dari layar tapi isiannya masih ada di state.
    const muatan = keMuatanBuatProspek({
      ...nilai,
      sumber: "WALK_IN",
      iklanId: "iklan-7",
    });

    expect(muatan.iklanId).toBeNull();
  });

  it("tidak mengirim referralNama yang tersembunyi saat sumbernya bukan REFERRAL", () => {
    const muatan = keMuatanBuatProspek({
      ...nilai,
      sumber: "LAPANGAN",
      referralNama: "Pak Joko",
    });

    expect(muatan.referralNama).toBeNull();
  });

  it("memangkas spasi pada ID kampanye yang diisi manual", () => {
    // Isian manual dipakai saat daftar kampanye tak bisa dimuat atau
    // terpotong; ID bersalin-tempel sering membawa spasi di ujung.
    const muatan = keMuatanBuatProspek({
      ...nilai,
      sumber: "IKLAN",
      iklanId: "  iklan-7  ",
    });

    expect(muatan.iklanId).toBe("iklan-7");
  });

  it("mengirim referralNama saat sumbernya REFERRAL", () => {
    expect(keMuatanBuatProspek(nilaiLengkap).referralNama).toBe("Pak Joko");
  });

  it("tidak pernah mengirim pemilikId", () => {
    // Form memberi tahu pemakai bahwa prospek tercatat atas namanya. Itu hanya
    // benar selama pemilikId tidak dikirim (`akses-presurvei.ts:41-48`).
    expect(keMuatanBuatProspek(nilaiLengkap)).not.toHaveProperty("pemilikId");
  });

  it("memetakan setiap medan ke kuncinya sendiri", () => {
    expect(keMuatanBuatProspek(nilaiLengkap)).toEqual({
      nama: "Siti Aminah",
      noTelp: "081299990000",
      email: "siti@contoh.id",
      alamat: "Jl. Kenanga 4",
      sumber: "REFERRAL",
      iklanId: null,
      referralNama: "Pak Joko",
      paketDiminati: "Paket 20 Mbps",
      catatan: "Minta dihubungi sore",
    });
  });
});

describe("keMuatanUbahProspek — medan yang tidak dikenal PATCH", () => {
  it("tidak mengirim sumber, iklanId, maupun referralNama", () => {
    // `ubahProspekSchema` tidak mengenal ketiganya dan men-strip-nya tanpa
    // error; mengirimnya membuat pemakai yakin atribusinya berubah.
    const muatan = keMuatanUbahProspek(nilaiLengkap);

    expect(muatan).not.toHaveProperty("sumber");
    expect(muatan).not.toHaveProperty("iklanId");
    expect(muatan).not.toHaveProperty("referralNama");
  });

  it("mengirim null untuk medan opsional yang dikosongkan, supaya isinya terhapus", () => {
    const muatan = keMuatanUbahProspek({ ...nilaiLengkap, email: "  " });

    expect(muatan.email).toBeNull();
  });

  it("lolos validasi schema ubah", () => {
    expect(
      ubahProspekSchema.safeParse(keMuatanUbahProspek(nilaiLengkap)).success,
    ).toBe(true);
  });
});

describe("keputusan bergantung-mode", () => {
  it("mode ubah memakai pembentuk ubah — arah yang senyap bila tertukar", () => {
    expect(muatanUntukMode(MODE_UBAH, nilaiLengkap)).not.toHaveProperty(
      "sumber",
    );
  });

  it("mode buat memakai pembentuk buat", () => {
    expect(muatanUntukMode(MODE_BUAT, nilaiLengkap)).toHaveProperty(
      "sumber",
      "REFERRAL",
    );
  });

  it("schema mode ubah menerima muatan ubah, schema mode buat menolaknya", () => {
    // Test perilaku yang menemani pilihan schema: muatan ubah tidak membawa
    // `sumber`, dan hanya schema ubah yang menerimanya.
    const muatanUbah = keMuatanUbahProspek(nilaiLengkap);

    expect(schemaUntukMode(MODE_UBAH).safeParse(muatanUbah).success).toBe(true);
    expect(schemaUntukMode(MODE_BUAT).safeParse(muatanUbah).success).toBe(
      false,
    );
  });

  it("schema mode buat menegakkan matriks atribusi sumber", () => {
    const tanpaKampanye = keMuatanBuatProspek({
      ...nilai,
      sumber: "IKLAN",
      iklanId: "",
    });

    expect(schemaUntukMode(MODE_BUAT).safeParse(tanpaKampanye).success).toBe(
      false,
    );
  });

  it("mode ubah menulis ke endpoint detail dengan PATCH", () => {
    expect(opsiSimpanUntukMode(MODE_UBAH)).toMatchObject({
      url: "/api/presurvei/prospek/prospek-9",
      method: "PATCH",
    });
  });

  it("mode buat menulis ke endpoint koleksi dengan POST", () => {
    expect(opsiSimpanUntukMode(MODE_BUAT)).toMatchObject({
      url: "/api/presurvei/prospek",
      method: "POST",
    });
  });
});

describe("denganAbaikanDuplikat", () => {
  it("mengirim ulang muatan yang sama dengan izin melewati duplikat", () => {
    const muatan = keMuatanBuatProspek(nilaiLengkap);

    expect(denganAbaikanDuplikat(muatan)).toEqual({
      ...keMuatanBuatProspek(nilaiLengkap),
      abaikanDuplikat: true,
    });
  });

  it("lolos validasi schema buat", () => {
    expect(
      buatProspekSchema.safeParse(
        denganAbaikanDuplikat(keMuatanBuatProspek(nilai)),
      ).success,
    ).toBe(true);
  });
});

describe("bacaDuplikat", () => {
  const bentrok = [
    {
      id: "prospek-lama",
      nama: "Budi Lama",
      status: "DIHUBUNGI",
      pemilikId: "sales-3",
    },
  ];

  /** Bentuk kawat dari `lib/api/handler.ts:369-379`; lihat test kawat terpisah. */
  const badanDuplikat = {
    success: false,
    error: "Sudah ada prospek aktif dengan nomor telepon ini",
    code: "DUPLIKAT",
    details: { duplikat: bentrok },
  };

  it("mengembalikan prospek yang bentrok dari penolakan duplikat", () => {
    expect(bacaDuplikat(409, badanDuplikat)).toEqual(bentrok);
  });

  it("mengabaikan 409 berkode lain — transisi status tak sah juga 409", () => {
    expect(
      bacaDuplikat(409, { ...badanDuplikat, code: "INVALID_STATE" }),
    ).toBeNull();
  });

  it("mengabaikan kode DUPLIKAT pada status selain 409", () => {
    expect(bacaDuplikat(400, badanDuplikat)).toBeNull();
  });

  it("mengabaikan penolakan tanpa daftar duplikat", () => {
    expect(bacaDuplikat(409, { ...badanDuplikat, details: {} })).toBeNull();
    expect(
      bacaDuplikat(409, { ...badanDuplikat, details: { duplikat: [] } }),
    ).toBeNull();
    expect(bacaDuplikat(409, null)).toBeNull();
  });

  it("tidak membaca daftar dari akar badan", () => {
    // `duplikat` ada di bawah `details`, bukan di akar.
    const { details: _details, ...tanpaDetails } = badanDuplikat;
    expect(
      bacaDuplikat(409, { ...tanpaDetails, duplikat: bentrok }),
    ).toBeNull();
  });
});

describe("kunciKolomSetelahSimpan", () => {
  it("menginvalidasi kolom status prospek yang dikembalikan server", () => {
    expect(
      kunciKolomSetelahSimpan({ success: true, data: { status: "TERTARIK" } }),
    ).toEqual([KUNCI_KOLOM_PROSPEK, "TERTARIK"]);
  });

  it("menginvalidasi seluruh kolom bila statusnya tak terbaca", () => {
    expect(kunciKolomSetelahSimpan({ success: true })).toEqual([
      KUNCI_KOLOM_PROSPEK,
    ]);
    expect(
      kunciKolomSetelahSimpan({ success: true, data: { status: "ASING" } }),
    ).toEqual([KUNCI_KOLOM_PROSPEK]);
    expect(kunciKolomSetelahSimpan(null)).toEqual([KUNCI_KOLOM_PROSPEK]);
  });
});

describe("ringkasPilihanKampanye", () => {
  const iklan = (id: string, isBerjalan: boolean): IklanListItemDto => ({
    id,
    nama: `Kampanye ${id}`,
    kode: id,
    channel: "META",
    tanggalMulai: "2026-09-01T00:00:00.000Z",
    tanggalSelesai: null,
    isAktif: true,
    isBerjalan,
  });

  it("hanya menyisakan kampanye yang sedang berjalan", () => {
    const hasil = ringkasPilihanKampanye({
      data: [iklan("a", true), iklan("b", false)],
      meta: { total: 2 },
    });

    expect(hasil.pilihan.map((item) => item.id)).toEqual(["a"]);
  });

  it("menandai daftar terpotong bila server punya lebih banyak kampanye aktif", () => {
    const hasil = ringkasPilihanKampanye({
      data: [iklan("a", true)],
      meta: { total: 101 },
    });

    expect(hasil.isTerpotong).toBe(true);
  });

  it("membandingkan total dengan jumlah SEBELUM disaring isBerjalan", () => {
    // `meta.total` menghitung kampanye aktif. Membandingkannya dengan jumlah
    // setelah disaring akan menyebut daftar lengkap sebagai terpotong setiap
    // kali ada kampanye aktif yang belum mulai.
    const hasil = ringkasPilihanKampanye({
      data: [iklan("a", true), iklan("b", false)],
      meta: { total: 2 },
    });

    expect(hasil.isTerpotong).toBe(false);
  });
});

describe("keNilaiForm", () => {
  const detail: ProspekDetailDto = {
    id: "prospek-9",
    nama: "Siti Aminah",
    noTelp: "081299990000",
    alamat: "Jl. Kenanga 4",
    sumber: "IKLAN",
    status: "TERTARIK",
    pemilikId: "sales-3",
    paketDiminati: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    email: null,
    latitude: null,
    longitude: null,
    shareloc: null,
    iklanId: "iklan-7",
    registrationId: null,
    referralNama: null,
    catatan: "Minta dihubungi sore",
    canvasingId: null,
    konversiAt: null,
    isSiapDipromosikan: false,
    updatedAt: "2026-09-02T00:00:00.000Z",
  };

  it("mengubah null menjadi medan kosong dan menyalin sisanya", () => {
    expect(keNilaiForm(detail)).toEqual({
      nama: "Siti Aminah",
      noTelp: "081299990000",
      email: "",
      alamat: "Jl. Kenanga 4",
      sumber: "IKLAN",
      iklanId: "iklan-7",
      referralNama: "",
      paketDiminati: "",
      catatan: "Minta dihubungi sore",
    });
  });
});

describe("keKesalahanForm", () => {
  it("mengalihkan refine level-akar ke pesan level-form", () => {
    expect(
      keKesalahanForm([
        {
          path: [],
          message: "Prospek dari iklan wajib menunjuk ke sebuah iklan",
        },
        { path: ["noTelp"], message: "Nomor telepon minimal 8 digit" },
      ]),
    ).toEqual({
      [KUNCI_KESALAHAN_FORM]:
        "Prospek dari iklan wajib menunjuk ke sebuah iklan",
      noTelp: "Nomor telepon minimal 8 digit",
    });
  });
});
