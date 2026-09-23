import {
  KEGIATAN_HASIL_CONFIG,
  type KegiatanHasil,
  type KegiatanListItemDto,
} from "@/modules/presurvei/client";

import { BATAS_PETA } from "./kegiatanListQuery";

/**
 * Warna penanda per hasil kegiatan, sejajar dengan badge di daftar.
 *
 * Heksadesimal, bukan kelas Tailwind seperti `KEGIATAN_HASIL_CONFIG.warna`:
 * penanda digambar OpenLayers ke atas kanvas, di luar jangkauan CSS.
 * `Record<KegiatanHasil, string>` memaksa hasil baru dijawab saat kompilasi.
 */
const WARNA_PENANDA: Record<KegiatanHasil, string> = {
  TERTARIK: "#f59e0b",
  PERLU_FOLLOWUP: "#3b82f6",
  TIDAK_MINAT: "#9ca3af",
  TIDAK_ADA_ORANG: "#94a3b8",
  DEAL: "#10b981",
};

export interface TitikKegiatan {
  id: string;
  latitude: number;
  longitude: number;
  hasil: string;
  label: string;
  alamat: string | null;
  warna: string;
}

/** Sebab-sebab kegiatan tidak ikut tergambar di peta. */
export interface RingkasanTakTergambar {
  tanpaKoordinat: number;
  diLuarBatas: number;
}

/**
 * Titik peta dari daftar kegiatan, beserta jumlah yang tidak punya koordinat.
 *
 * Yang tanpa koordinat tidak dibuang diam-diam: telepon, chat, walk-in kantor,
 * dan kegiatan yang dicatat dari web memang tidak terjadi di suatu titik, dan
 * pemakainya perlu tahu berapa banyak yang tidak tergambar.
 */
export function keTitikPeta(baris: KegiatanListItemDto[]): {
  titik: TitikKegiatan[];
  tanpaKoordinat: number;
} {
  const titik: TitikKegiatan[] = [];
  let tanpaKoordinat = 0;

  for (const item of baris) {
    // Perbandingan eksplisit terhadap null, bukan truthiness: lintang 0
    // adalah khatulistiwa, dan Indonesia dilaluinya.
    if (item.latitude === null || item.longitude === null) {
      tanpaKoordinat += 1;
      continue;
    }

    const tampilan = KEGIATAN_HASIL_CONFIG[item.hasil];

    titik.push({
      id: item.id,
      latitude: item.latitude,
      longitude: item.longitude,
      hasil: item.hasil,
      label: tampilan.label,
      alamat: item.alamatDikunjungi,
      warna: WARNA_PENANDA[item.hasil],
    });
  }

  return { titik, tanpaKoordinat };
}

/**
 * Jumlah kegiatan yang cocok dengan filter tapi tidak ikut terambil.
 *
 * Mode peta meminta `limit=100`, batas tertinggi yang diizinkan validator.
 * Di atas itu server memotong, dan tanpa hitungan ini pemotongannya SENYAP:
 * pemakai melihat seratus titik dan menyimpulkan itulah seluruh kunjungan
 * pada rentang yang ia pilih. Sebabnya berbeda dari kegiatan tanpa koordinat,
 * tapi kesalahpahaman yang ditimbulkannya sama persis, jadi ia diperlakukan
 * sama: dihitung, lalu disebutkan.
 *
 * `totalCocok` ditulis `number`, tapi di titik pakainya ia berasal dari
 * `meta?.total` yang bernilai `undefined` selama pengambilan pertama —
 * `strictNullChecks: false` meloloskannya tanpa keluhan. Lantai nol di bawah
 * mengerjakan dua tugas sekaligus karena itu: ia menahan selisih negatif DAN
 * `NaN` (perbandingan apa pun dengan `NaN` bernilai false) keluar ke layar.
 * Penjaga `typeof` terpisah sempat ditulis di sini lalu dibuang — mutasi
 * membuktikannya no-op, tidak ada satu pun masukan yang membedakannya.
 *
 * Satu objek bernama, bukan dua parameter `number` berurutan: menukarnya
 * senyap ke arah yang salah (`terambil - total` selalu negatif, lalu dilantai
 * jadi nol, sehingga peringatannya tidak pernah muncul) dan compiler tidak
 * menolaknya. Dengan field bernama, tertukarnya terbaca salah di titik pakai.
 */
export function jumlahDiLuarBatas(hitungan: {
  totalCocok: number;
  jumlahTerambil: number;
}): number {
  const sisa = hitungan.totalCocok - hitungan.jumlahTerambil;

  return sisa > 0 ? sisa : 0;
}

/**
 * Keterangan di bawah peta tentang kegiatan yang TIDAK tergambar.
 *
 * Fungsi murni, bukan rangkaian `&&` di dalam JSX, supaya kalimat yang dibaca
 * pemakai bisa diuji tanpa merender peta — dan supaya kedua sebabnya dirakit
 * di satu tempat, dengan urutan yang tetap.
 *
 * Array kosong berarti "semua tergambar": pemanggilnya tidak perlu tahu ada
 * berapa sebab, cukup memetakan apa pun yang keluar.
 */
export function keteranganPeta(ringkasan: RingkasanTakTergambar): string[] {
  const baris: string[] = [];

  if (ringkasan.tanpaKoordinat > 0) {
    baris.push(
      `${ringkasan.tanpaKoordinat} kegiatan tidak tergambar karena tidak punya titik lokasi — telepon, chat, dan kegiatan yang dicatat dari web.`,
    );
  }

  if (ringkasan.diLuarBatas > 0) {
    baris.push(
      `${ringkasan.diLuarBatas} kegiatan lain cocok dengan filter ini tapi tidak ikut digambar — peta memuat paling banyak ${BATAS_PETA} kegiatan terbaru. Persempit rentang tanggalnya untuk melihat sisanya.`,
    );
  }

  return baris;
}
