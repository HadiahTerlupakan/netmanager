import { JalurUniversal } from "./JalurUniversal";

interface JalurPratinjauProps {
  /** Titik asal jalur; null berarti belum ada yang dipilih. */
  asal: { lat: number; lng: number } | null;
  /** Titik belok yang sudah diklik pemakai. */
  belokan: Array<[number, number]>;
  /** Hanya digambar saat mode gambar jalur sedang aktif. */
  aktif: boolean;
}

/** Kuning: jalur yang belum tersimpan, dibedakan dari warna jenis kabel. */
const WARNA_PRATINJAU = "#facc15";
const BOBOT_PRATINJAU = 4;
const OPASITAS_PRATINJAU = 0.8;

/**
 * Jalur kabel yang sedang digambar.
 *
 * Dipakai peta jaringan dan peta perencanaan OSP, karena keduanya menggambar
 * jalur dengan cara yang sama: klik titik asal, klik peta untuk tiap titik
 * belok. Warnanya sengaja bukan warna jenis kabel — garis ini belum
 * tersimpan, dan tidak boleh tertukar dengan jalur yang sudah ada.
 */
export function JalurPratinjau({ asal, belokan, aktif }: JalurPratinjauProps) {
  if (!aktif || !asal || belokan.length === 0) return null;

  return (
    <JalurUniversal
      jejak={[asal, ...belokan.map(([lat, lng]) => ({ lat, lng }))]}
      warna={WARNA_PRATINJAU}
      bobot={BOBOT_PRATINJAU}
      putus
      opasitas={OPASITAS_PRATINJAU}
    />
  );
}
