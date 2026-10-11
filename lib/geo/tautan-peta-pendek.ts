import {
  isUrlPetaAman,
  uraikanTautanPeta,
  type HasilUraiTautan,
} from "./tautan-peta";

/**
 * Menukar tautan pendek Google Maps menjadi tautan panjang yang memuat
 * koordinat.
 *
 * Ini satu-satunya tempat di alur ini yang mengirim permintaan keluar
 * berdasarkan teks yang diketik pengguna, jadi penjaganya ketat sejak awal:
 * seluruh aturan URL aman (https, tanpa kredensial, tanpa port khusus, host
 * dalam daftar izin) diperiksa ulang **di setiap lompatan pengalihan**, bukan
 * sekali di awal; ada batas jumlah pengalihan dan waktu; query dan fragment
 * dibuang sebelum permintaan dikirim; dan hanya header `location` yang dibaca
 * — badan respons tidak pernah diambil.
 */

const BATAS_PENGALIHAN = 3;
const BATAS_WAKTU_MS = 5000;
const STATUS_PENGALIHAN_MIN = 300;
const STATUS_PENGALIHAN_MAKS = 399;

const PESAN_GAGAL_UMUM =
  "Tautan tidak dapat dibuka. Buka tautannya di browser, lalu salin koordinatnya.";

/**
 * Hasil gagal dengan pesan umum: jangan bocorkan alamat internal, host yang
 * dicoba, atau galat jaringan mentah ke klien.
 */
function buatGagalUmum(): HasilUraiTautan {
  return { status: "gagal", alasan: PESAN_GAGAL_UMUM };
}

/** Salinan URL tanpa query dan fragment, aman untuk dikirim sebagai permintaan keluar. */
function buangQueryDanFragment(url: URL): URL {
  const salinan = new URL(url.toString());
  salinan.search = "";
  salinan.hash = "";
  return salinan;
}

/** Mengambil URL tujuan dari respons pengalihan; null bila bukan pengalihan. */
function bacaLokasiPengalihan(respons: Response): string | null {
  const { status } = respons;
  if (status < STATUS_PENGALIHAN_MIN || status > STATUS_PENGALIHAN_MAKS) {
    return null;
  }
  return respons.headers.get("location");
}

/** Melepas koneksi tanpa membaca badan respons. */
async function lepaskanBadan(respons: Response): Promise<void> {
  try {
    await respons.body?.cancel();
  } catch {
    // Pelepasan koneksi bersifat upaya terbaik; tidak memengaruhi hasil.
  }
}

/**
 * Mengirim satu permintaan tanpa mengikuti pengalihan. Mengembalikan header
 * `location` (null bila tidak ada) atau undefined bila permintaan gagal.
 */
async function kirimPermintaan(
  ambil: typeof fetch,
  url: URL,
  method: "HEAD" | "GET",
): Promise<string | null | undefined> {
  try {
    const respons = await ambil(url.toString(), {
      method,
      redirect: "manual",
      credentials: "omit",
      signal: AbortSignal.timeout(BATAS_WAKTU_MS),
    });
    const lokasi = bacaLokasiPengalihan(respons);
    await lepaskanBadan(respons);
    return lokasi;
  } catch {
    return undefined;
  }
}

/**
 * Mencari tujuan pengalihan: HEAD dahulu, dan bila tidak ada header `location`
 * ulangi sekali dengan GET karena sebagian pemendek tidak menjawab HEAD dengan
 * pengalihan. Mengembalikan null bila tidak ada tujuan atau permintaan gagal.
 */
async function cariTujuanPengalihan(
  ambil: typeof fetch,
  url: URL,
): Promise<string | null> {
  const lewatHead = await kirimPermintaan(ambil, url, "HEAD");
  if (lewatHead === undefined) return null;
  if (lewatHead) return lewatHead;

  const lewatGet = await kirimPermintaan(ambil, url, "GET");
  return lewatGet ?? null;
}

/** Selesaikan tautan pendek menjadi koordinat. `ambil` dapat diinjeksi untuk tes. */
export async function selesaikanTautanPendek(
  url: string,
  ambil: typeof fetch = fetch,
): Promise<HasilUraiTautan> {
  let sekarang: URL;
  try {
    sekarang = new URL(url);
  } catch {
    return buatGagalUmum();
  }

  for (let langkah = 0; langkah < BATAS_PENGALIHAN; langkah += 1) {
    if (!isUrlPetaAman(sekarang)) return buatGagalUmum();

    const tujuan = await cariTujuanPengalihan(
      ambil,
      buangQueryDanFragment(sekarang),
    );
    if (!tujuan) return buatGagalUmum();

    let berikutnya: URL;
    try {
      berikutnya = new URL(tujuan, sekarang);
    } catch {
      return buatGagalUmum();
    }

    if (!isUrlPetaAman(berikutnya)) return buatGagalUmum();

    // Koordinat bisa berada di query tujuan, jadi diurai utuh sebelum dibuang.
    const hasil = uraikanTautanPeta(berikutnya.toString());
    if (hasil.status === "berhasil") return hasil;
    if (hasil.status === "gagal") return buatGagalUmum();

    sekarang = berikutnya;
  }

  return buatGagalUmum();
}
