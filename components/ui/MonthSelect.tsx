"use client";

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
/** Rentang tahun yang ditawarkan di sekitar tahun berjalan. */
const TAHUN_KE_BELAKANG = 3;
const TAHUN_KE_DEPAN = 1;

/** Daftar tahun pilihan; tahun nilai saat ini selalu ikut walau di luar rentang. */
export function daftarTahunPilihan(tahunNilai: number, tahunSekarang: number): number[] {
  const tahun = new Set<number>([tahunNilai]);
  for (let t = tahunSekarang - TAHUN_KE_BELAKANG; t <= tahunSekarang + TAHUN_KE_DEPAN; t += 1) tahun.add(t);
  return [...tahun].sort((a, b) => b - a);
}

/**
 * Pemilih periode "YYYY-MM" berupa dropdown bulan + tahun. Pengganti
 * `<input type="month">` yang di Safari/Firefox hanya tampil sebagai kotak teks.
 */
export function MonthSelect({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (periode: string) => void;
  className?: string;
}) {
  const [tahun, bulan] = value.split("-").map(Number);
  const tahunPilihan = daftarTahunPilihan(tahun, new Date().getFullYear());
  const ubah = (tahunBaru: number, bulanBaru: number) =>
    onChange(`${tahunBaru}-${String(bulanBaru).padStart(2, "0")}`);

  return (
    <div className="flex gap-2">
      <select
        aria-label="Bulan"
        value={bulan}
        onChange={(e) => ubah(tahun, Number(e.target.value))}
        className={className}
      >
        {NAMA_BULAN.map((nama, indeks) => (
          <option key={nama} value={indeks + 1}>
            {nama}
          </option>
        ))}
      </select>
      <select
        aria-label="Tahun"
        value={tahun}
        onChange={(e) => ubah(Number(e.target.value), bulan)}
        className={className}
      >
        {tahunPilihan.map((pilihan) => (
          <option key={pilihan} value={pilihan}>
            {pilihan}
          </option>
        ))}
      </select>
    </div>
  );
}
