import { describe, expect, it } from "vitest";

import { BATAS_PETA } from "@/app/admin/presurvei/kegiatan/kegiatanListQuery";
import {
  jumlahDiLuarBatas,
  keTitikPeta,
  keteranganPeta,
  koordinatLonLat,
  type TitikKegiatan,
} from "@/app/admin/presurvei/kegiatan/titikPeta";
import {
  KEGIATAN_HASIL,
  type KegiatanListItemDto,
} from "@/modules/presurvei/client";

const kegiatan = (over: Partial<KegiatanListItemDto>): KegiatanListItemDto =>
  ({
    id: "kegiatan-1",
    jenis: "KUNJUNGAN",
    userId: "sales-1",
    prospekId: null,
    waktuMulai: "2026-09-10T02:00:00.000Z",
    alamatDikunjungi: "Jl. Merdeka 10",
    ditemuiNama: "Budi",
    hasil: "TERTARIK",
    jumlahFoto: 2,
    latitude: -6.2,
    longitude: 106.8,
    ...over,
  }) as KegiatanListItemDto;

describe("keTitikPeta", () => {
  it("memetakan kegiatan berkoordinat menjadi titik", () => {
    // Lintang dan bujur sengaja berjauhan: keduanya `number` bersebelahan dan
    // tertukarnya tidak ditolak compiler — penanda akan mendarat di laut.
    const hasil = keTitikPeta([kegiatan({})]);

    expect(hasil.titik).toHaveLength(1);
    expect(hasil.titik[0]).toMatchObject({
      id: "kegiatan-1",
      latitude: -6.2,
      longitude: 106.8,
      hasil: "TERTARIK",
    });
  });

  it("menghitung kegiatan tanpa koordinat alih-alih membuangnya diam-diam", () => {
    // Telepon dan walk-in kantor tidak punya titik. Tanpa hitungan ini,
    // manajer melihat satu titik dari tiga kegiatan dan mengira timnya diam.
    const hasil = keTitikPeta([
      kegiatan({}),
      kegiatan({ id: "kegiatan-2", latitude: null, longitude: null }),
      kegiatan({ id: "kegiatan-3", latitude: -6.9, longitude: null }),
    ]);

    expect(hasil.titik).toHaveLength(1);
    expect(hasil.tanpaKoordinat).toBe(2);
  });

  it("memperlakukan koordinat nol sebagai titik yang sah", () => {
    // Lintang 0 adalah khatulistiwa, dan Indonesia dilaluinya. Penyaringan
    // berbasis truthiness akan membuang kunjungan di Pontianak.
    const hasil = keTitikPeta([kegiatan({ latitude: 0, longitude: 109.3 })]);

    expect(hasil.titik).toHaveLength(1);
    expect(hasil.tanpaKoordinat).toBe(0);
  });

  it("memberi warna menurut hasil kegiatan", () => {
    const hasil = keTitikPeta([
      kegiatan({ hasil: "TERTARIK" }),
      kegiatan({ id: "kegiatan-2", hasil: "TIDAK_MINAT" }),
    ]);

    expect(hasil.titik[0].warna).not.toBe(hasil.titik[1].warna);
  });

  it("memberi warna berbeda untuk SETIAP hasil, bukan hanya dua yang diuji", () => {
    // Test di atas hanya membandingkan sepasang. Dua kelabu di tabel warna —
    // TIDAK_MINAT dan TIDAK_ADA_ORANG — berdekatan nilainya, dan menyamakan
    // tepat keduanya akan lolos test itu sementara peta kehilangan satu
    // kategori. Membandingkan seluruh anggota union menutup tiap pasangan.
    const hasil = keTitikPeta(
      KEGIATAN_HASIL.map((nilai, urutan) =>
        kegiatan({ id: `kegiatan-${urutan}`, hasil: nilai }),
      ),
    );

    const warnaUnik = new Set(hasil.titik.map((item) => item.warna));

    expect(hasil.titik).toHaveLength(KEGIATAN_HASIL.length);
    expect(warnaUnik.size).toBe(KEGIATAN_HASIL.length);
  });

  it("membawa label hasil dan alamat untuk isi popup", () => {
    // Popup penanda hanya punya ketiga field ini. `label` yang diisi kode enum
    // mentah (`item.hasil`) lolos `tsc` karena keduanya `string`, lalu popup
    // menampilkan "PERLU_FOLLOWUP" alih-alih "Perlu follow-up".
    const hasil = keTitikPeta([
      kegiatan({ hasil: "PERLU_FOLLOWUP", alamatDikunjungi: "Jl. Kenanga 4" }),
    ]);

    expect(hasil.titik[0].label).toBe("Perlu follow-up");
    expect(hasil.titik[0].alamat).toBe("Jl. Kenanga 4");
  });

  it("meneruskan alamat kosong apa adanya, bukan sebagai teks", () => {
    // `alamatDikunjungi ?? ""` di sini akan membuat popup menampilkan baris
    // alamat kosong alih-alih menyembunyikannya.
    const hasil = keTitikPeta([kegiatan({ alamatDikunjungi: null })]);

    expect(hasil.titik[0].alamat).toBeNull();
  });
});

describe("koordinatLonLat", () => {
  /**
   * Nilainya sengaja berlawanan tanda dan berjauhan besarannya: kalau lintang
   * dan bujur kembar atau berdekatan, tertukarnya tidak terlihat di assertion
   * mana pun. Literal terpisah, bukan keluaran `keTitikPeta`, supaya penukaran
   * di kedua fungsi tidak bisa saling meniadakan.
   */
  const TITIK_JAKARTA: TitikKegiatan = Object.freeze({
    id: "kegiatan-1",
    latitude: -6.2,
    longitude: 106.8,
    hasil: "TERTARIK",
    label: "Tertarik",
    alamat: "Jl. Merdeka 10",
    warna: "#f59e0b",
  });

  it("menaruh bujur di elemen pertama, urutan yang diminta fromLonLat", () => {
    // Urutan [bujur, lintang] adalah kebalikan dari cara koordinat dibaca
    // orang, dan keduanya `number` — tertukarnya tidak ditolak compiler.
    // Akibatnya bukan penanda yang bergeser sedikit: lintang 106,8° tidak ada,
    // Web Mercator melempar titiknya ke luar jangkauan, dan SELURUH penanda
    // hilang dari layar tanpa satu pun pesan — persis kesalahpahaman yang
    // seluruh layar ini dibangun untuk mencegah.
    const [bujur, lintang] = koordinatLonLat(TITIK_JAKARTA);

    expect(bujur).toBe(106.8);
    expect(lintang).toBe(-6.2);
  });

  it("mengembalikan tepat dua elemen", () => {
    expect(koordinatLonLat(TITIK_JAKARTA)).toHaveLength(2);
  });
});

describe("jumlahDiLuarBatas", () => {
  it("menghitung kegiatan yang cocok filter tapi tidak ikut terambil", () => {
    // Inilah pemotongan senyap: 137 kegiatan cocok, peta hanya memuat 100.
    // Tanpa hitungan ini pemakai melihat 100 titik dan mengira itu semuanya.
    expect(jumlahDiLuarBatas({ totalCocok: 137, jumlahTerambil: 100 })).toBe(
      37,
    );
  });

  it("diam saat seluruh yang cocok sudah terambil", () => {
    expect(jumlahDiLuarBatas({ totalCocok: 42, jumlahTerambil: 42 })).toBe(0);
  });

  it("tidak pernah mengembalikan angka negatif", () => {
    // `total - terambil` tanpa lantai akan mencetak "-5 kegiatan lain cocok".
    expect(jumlahDiLuarBatas({ totalCocok: 5, jumlahTerambil: 10 })).toBe(0);
  });

  it("diam saat meta amplop belum sampai", () => {
    // `meta` bernilai `undefined` selama pengambilan pertama, dan
    // `strictNullChecks: false` meloloskannya masuk ke parameter `number`.
    // Yang menahannya adalah lantai nol yang sama dengan test di atas —
    // perbandingan apa pun dengan `NaN` bernilai false. Penjaga `typeof`
    // terpisah sempat ditulis lalu dibuang setelah mutasi membuktikannya
    // no-op; test ini tetap ada karena yang dijaganya kontrak, bukan caranya.
    expect(
      jumlahDiLuarBatas({
        totalCocok: undefined as unknown as number,
        jumlahTerambil: 0,
      }),
    ).toBe(0);
  });
});

describe("keteranganPeta", () => {
  it("tidak berkata apa-apa saat seluruh kegiatan tergambar", () => {
    expect(keteranganPeta({ tanpaKoordinat: 0, diLuarBatas: 0 })).toEqual([]);
  });

  it("menyebut kegiatan yang tidak punya titik lokasi", () => {
    const baris = keteranganPeta({ tanpaKoordinat: 4, diLuarBatas: 0 });

    expect(baris).toHaveLength(1);
    expect(baris[0]).toMatch(/^4 kegiatan tidak tergambar/);
    expect(baris[0]).toContain("telepon");
  });

  it("memperingatkan bahwa peta terpotong batasnya", () => {
    const baris = keteranganPeta({ tanpaKoordinat: 0, diLuarBatas: 37 });

    expect(baris).toHaveLength(1);
    expect(baris[0]).toMatch(/^37 kegiatan lain/);
    // Batasnya disebut supaya pemakai tahu harus mempersempit apa; diambil
    // dari konstanta yang sama dengan pembentuk URL, jadi mengubah batas di
    // satu tempat tidak bisa meninggalkan kalimat ini berbohong.
    expect(baris[0]).toContain(String(BATAS_PETA));
  });

  it("menyebut kedua sebab dengan angkanya masing-masing", () => {
    // Angka sengaja berbeda jauh: kalau kedua field tertukar di dalam fungsi,
    // kalimatnya tetap terbentuk dan hanya angkanya yang salah.
    const baris = keteranganPeta({ tanpaKoordinat: 4, diLuarBatas: 37 });

    expect(baris).toHaveLength(2);
    expect(baris[0]).toMatch(/^4 kegiatan tidak tergambar/);
    expect(baris[1]).toMatch(/^37 kegiatan lain/);
  });
});
