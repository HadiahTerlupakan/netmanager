"use client";

import { keteranganPeta, type RingkasanTakTergambar } from "./titikPeta";

/**
 * Keterangan di bawah peta: kegiatan mana yang TIDAK tergambar, dan kenapa.
 *
 * Berdiri sebagai komponennya sendiri, bukan potongan JSX di dalam
 * `KegiatanPeta`, karena menjangkaunya di sana menuntut belasan mock modul `ol`
 * yang tidak menegaskan apa pun tentang petanya — lebih mahal daripada nilainya,
 * BUKAN tak terjangkau. Di sini ia presentasional murni — props masuk, JSX
 * keluar — sehingga kabelnya dijaga render sungguhan di
 * `tests/app/presurvei-peta-keterangan.test.tsx` seharga 1,7 detik.
 *
 * Props-nya memakai nama field `RingkasanTakTergambar` apa adanya supaya
 * meneruskannya tertukar terbaca salah di JSX pemanggil, tanpa menjalankan
 * apa pun.
 */
export function KegiatanPetaKeterangan({
  tanpaKoordinat,
  diLuarBatas,
}: RingkasanTakTergambar) {
  const baris = keteranganPeta({ tanpaKoordinat, diLuarBatas });

  if (baris.length === 0) return null;

  return (
    <div role="note" aria-label="Kegiatan yang tidak tergambar di peta">
      {baris.map((teks) => (
        <p key={teks} className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {teks}
        </p>
      ))}
    </div>
  );
}
