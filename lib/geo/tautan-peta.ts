/**
 * Pengurai tautan Google Maps menjadi koordinat.
 *
 * Murni dan tanpa jaringan. Tautan pendek (`maps.app.goo.gl`, `goo.gl/maps`)
 * tidak memuat koordinat sama sekali — untuk itu fungsi ini mengembalikan
 * `butuh_resolusi` dengan URL yang sudah dinormalisasi, dan pemanggil memutuskan
 * apakah mau menukarnya lewat jaringan (lihat `lib/geo/tautan-peta-pendek.ts`).
 *
 * Pengurai ini juga menjadi penjaga pertama bagi penyelesai pendek: apa pun yang
 * lolos di sini akan dikirimi permintaan keluar, jadi aturan protokol, host,
 * kredensial, dan port ditegakkan di sini, bukan di hilir.
 */

/**
 * Daftar host Google yang diizinkan, disebut satu per satu. Dibekukan saat
 * runtime agar tidak bisa diubah diam-diam. Jangan diganti pola wildcard ccTLD,
 * karena daftar ini adalah dasar penjaga SSRF.
 */
export const HOST_PETA_DIIZINKAN: readonly string[] = Object.freeze([
  "maps.app.goo.gl",
  "goo.gl",
  "maps.google.com",
  "www.google.com",
  "google.com",
  "google.co.id",
  "www.google.co.id",
  "maps.google.co.id",
]);

const HOST_TAUTAN_PENDEK_KHUSUS_PETA = "maps.app.goo.gl";
const HOST_PEMENDEK_GOO_GL = "goo.gl";
const PROTOKOL_DIIZINKAN = "https:";
const PATH_PETA_GOO_GL = "/maps";

/** Pola koordinat tempat Google: `!3d<lat>!4d<lng>` pada path. */
const POLA_KOORDINAT_TEMPAT = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/;

/** Pola posisi kamera Google: `@<lat>,<lng>` pada path. */
const POLA_POSISI_KAMERA = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;

/** Pola pasangan koordinat bernilai desimal dalam parameter `q` atau `query`. */
const POLA_PASANGAN_TEKS = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

export type HasilUraiTautan =
  | { status: "berhasil"; latitude: number; longitude: number }
  | { status: "butuh_resolusi"; url: string }
  | { status: "gagal"; alasan: string };

/** Membuat hasil gagal dengan alasan yang bisa ditampilkan ke pengguna. */
function buatHasilGagal(alasan: string): HasilUraiTautan {
  return { status: "gagal", alasan };
}

/**
 * Titik nol derajat berada di Samudra Atlantik dan secara praktis selalu
 * berarti tempelan yang gagal, bukan lokasi sungguhan. Hanya pasangan
 * nol-nol yang ditolak; lintang nol atau bujur nol saja tetap sah.
 */
function isKoordinatMasukAkal(latitude: number, longitude: number): boolean {
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  if (latitude === 0 && longitude === 0) return false;
  return true;
}

/** Mengubah pasangan koordinat berbentuk teks menjadi hasil; null bila tidak cocok polanya. */
function uraiPasanganTeks(teks: string | null): HasilUraiTautan | null {
  if (!teks) return null;
  const cocok = teks.match(POLA_PASANGAN_TEKS);
  if (!cocok) return null;
  const latitude = Number(cocok[1]);
  const longitude = Number(cocok[2]);
  if (!isKoordinatMasukAkal(latitude, longitude)) {
    return buatHasilGagal("Koordinat di luar rentang yang masuk akal");
  }
  return { status: "berhasil", latitude, longitude };
}

/** Mengambil koordinat dari pola path (`!3d!4d` atau `@`); null bila pola tidak ada. */
function uraiDariPola(pola: RegExp, path: string): HasilUraiTautan | null {
  const cocok = path.match(pola);
  if (!cocok) return null;
  return uraiPasanganTeks(`${cocok[1]},${cocok[2]}`);
}

/** Mengambil koordinat dari parameter query `q` atau `query`; null bila tidak ada. */
function uraiDariParameterQuery(url: URL): HasilUraiTautan | null {
  return (
    uraiPasanganTeks(url.searchParams.get("q")) ??
    uraiPasanganTeks(url.searchParams.get("query"))
  );
}

/** Mengurai URL sah; null bila teks bukan URL. */
function parseUrlSah(teks: string): URL | null {
  try {
    return new URL(teks);
  } catch {
    return null;
  }
}

/**
 * Memeriksa protokol, kredensial, dan port. Hanya https tanpa username/password
 * dan tanpa port non-default yang lolos. Mengembalikan alasan penolakan, atau
 * null bila URL aman.
 */
function cariAlasanProtokolKredensialPort(url: URL): string | null {
  if (url.protocol !== PROTOKOL_DIIZINKAN) return "Tautan harus memakai https";
  if (url.username || url.password)
    return "Tautan tidak boleh memuat kredensial";
  if (url.port !== "") return "Tautan tidak boleh memakai port khusus";
  return null;
}

/** Memeriksa apakah host ada di daftar izin Google. */
function isHostDiizinkan(url: URL): boolean {
  return HOST_PETA_DIIZINKAN.includes(url.hostname);
}

/**
 * `goo.gl` adalah pemendek umum Google dan hanya dianggap tautan peta bila
 * path-nya `/maps` atau berada di bawahnya. `maps.app.goo.gl` khusus peta.
 */
function isGooGlBukanPeta(url: URL): boolean {
  if (url.hostname !== HOST_PEMENDEK_GOO_GL) return false;
  const adalahPeta =
    url.pathname === PATH_PETA_GOO_GL ||
    url.pathname.startsWith(`${PATH_PETA_GOO_GL}/`);
  return !adalahPeta;
}

/** Memeriksa tautan pendek yang perlu ditukar lewat jaringan oleh pemanggil. */
function isTautanPendek(url: URL): boolean {
  return (
    url.hostname === HOST_TAUTAN_PENDEK_KHUSUS_PETA ||
    url.hostname === HOST_PEMENDEK_GOO_GL
  );
}

/**
 * Menjalankan semua penjaga URL sebelum koordinat diurai. Mengembalikan hasil
 * gagal bila ada yang tidak lolos, atau null bila URL boleh diproses lebih lanjut.
 */
function periksaUrl(url: URL): HasilUraiTautan | null {
  const alasanProtokol = cariAlasanProtokolKredensialPort(url);
  if (alasanProtokol) return buatHasilGagal(alasanProtokol);
  if (!isHostDiizinkan(url)) {
    return buatHasilGagal("Tautan bukan dari Google Maps");
  }
  if (isGooGlBukanPeta(url)) {
    return buatHasilGagal("Pemendek goo.gl hanya diterima untuk tautan peta");
  }
  return null;
}

/**
 * Satu-satunya sumber kebenaran untuk "URL ini boleh dikirimi permintaan
 * keluar": https, tanpa kredensial, tanpa port khusus, host dalam daftar izin,
 * dan goo.gl hanya untuk path peta. Dipakai penyelesai tautan pendek di setiap
 * lompatan pengalihan.
 */
export function isUrlPetaAman(url: URL): boolean {
  return periksaUrl(url) === null;
}

/** Urai tautan Google Maps menjadi koordinat, tanpa menyentuh jaringan. */
export function uraikanTautanPeta(teks: string): HasilUraiTautan {
  const bersih = teks.trim();
  if (!bersih) return buatHasilGagal("Tautan kosong");

  const url = parseUrlSah(bersih);
  if (!url) return buatHasilGagal("Bukan tautan yang sah");

  const penolakan = periksaUrl(url);
  if (penolakan) return penolakan;

  if (isTautanPendek(url)) {
    return { status: "butuh_resolusi", url: url.toString() };
  }

  // `!3d`/`!4d` adalah koordinat tempatnya; `@` hanya posisi kamera. Yang
  // pertama lebih tepat, jadi didahulukan. Tautan rute yang memuat beberapa
  // pasang `!3d!4d` mengambil pasangan pertama (titik asal, bukan tujuan);
  // perilaku ini sengaja dipertahankan.
  return (
    uraiDariPola(POLA_KOORDINAT_TEMPAT, url.pathname) ??
    uraiDariParameterQuery(url) ??
    uraiDariPola(POLA_POSISI_KAMERA, url.pathname) ??
    buatHasilGagal("Tautan tidak memuat koordinat")
  );
}
