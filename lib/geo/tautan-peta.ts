/**
 * Pengurai tautan Google Maps menjadi koordinat.
 *
 * Murni dan tanpa jaringan. Tautan pendek (`maps.app.goo.gl`, `goo.gl/maps`)
 * tidak memuat koordinat sama sekali — untuk itu fungsi ini mengembalikan
 * `butuh_resolusi`, dan pemanggil memutuskan apakah mau menukarnya lewat
 * jaringan (lihat `lib/geo/tautan-peta-pendek.ts`).
 */

export const HOST_PETA_DIIZINKAN: readonly string[] = [
  "maps.app.goo.gl",
  "goo.gl",
  "maps.google.com",
  "www.google.com",
  "google.com",
];

const HOST_TAUTAN_PENDEK: readonly string[] = ["maps.app.goo.gl", "goo.gl"];

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
 * berarti tempelan yang gagal, bukan lokasi sungguhan.
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

/** Urai tautan Google Maps menjadi koordinat, tanpa menyentuh jaringan. */
export function uraikanTautanPeta(teks: string): HasilUraiTautan {
  const bersih = teks.trim();
  if (!bersih) return buatHasilGagal("Tautan kosong");

  const url = parseUrlSah(bersih);
  if (!url) return buatHasilGagal("Bukan tautan yang sah");

  if (!HOST_PETA_DIIZINKAN.includes(url.hostname)) {
    return buatHasilGagal("Tautan bukan dari Google Maps");
  }

  if (HOST_TAUTAN_PENDEK.includes(url.hostname)) {
    return { status: "butuh_resolusi", url: url.toString() };
  }

  // `!3d`/`!4d` adalah koordinat tempatnya; `@` hanya posisi kamera. Yang
  // pertama lebih tepat, jadi didahulukan.
  return (
    uraiDariPola(POLA_KOORDINAT_TEMPAT, url.pathname) ??
    uraiDariParameterQuery(url) ??
    uraiDariPola(POLA_POSISI_KAMERA, url.pathname) ??
    buatHasilGagal("Tautan tidak memuat koordinat")
  );
}
