"use client";

import dynamic from "next/dynamic";

import { JalurKabel } from "./google/JalurKabel";
import { useMesinPeta } from "./mesin-peta";

const JalurLeafletCadangan = dynamic(
  () =>
    import("./leaflet/JalurLeafletCadangan").then(
      (mod) => mod.JalurLeafletCadangan,
    ),
  { ssr: false },
);

interface JalurUniversalProps {
  /** Sumber → titik belok → tujuan, sudah lengkap. */
  jejak: Array<{ lat: number; lng: number }>;
  fiberType?: string | null;
  /** Warna pengganti warna jenis kabel, untuk garis non-kabel. */
  warna?: string;
  bobot?: number;
  /** Garis putus-putus: jalur rencana, atau jalur yang sedang digambar. */
  putus?: boolean;
  opasitas?: number;
  /**
   * Garis putus yang mengalir, menandai kabel terpasang di peta jaringan.
   *
   * Hanya berlaku pada mesin Leaflet: animasinya digerakkan CSS pada elemen
   * SVG, dan `Polyline` Google bukan elemen SVG yang bisa diberi kelas.
   * Dinyatakan sebagai maksud ("mengalir"), bukan sebagai nama kelas CSS,
   * supaya pemanggilnya tidak perlu tahu perbedaan itu.
   */
  animasi?: boolean;
  popup?: React.ReactNode;
}

const BOBOT_BAWAAN = 5;

/**
 * Satu jalur kabel, lepas dari mesin peta yang dipakai.
 *
 * Mesinnya dibaca dari `useMesinPeta`, sumber yang sama dengan
 * `PetaUniversal` dan `PenandaUniversal` — garis yang salah mesin tidak
 * tampil sama sekali dan tidak melaporkan galat apa pun.
 */
export function JalurUniversal({
  jejak,
  fiberType,
  warna,
  bobot = BOBOT_BAWAAN,
  putus,
  opasitas,
  animasi,
  popup,
}: JalurUniversalProps) {
  const mesin = useMesinPeta();

  if (mesin === "leaflet") {
    return (
      <JalurLeafletCadangan
        jejak={jejak.map((titik) => [titik.lat, titik.lng])}
        fiberType={fiberType}
        warna={warna}
        bobot={bobot}
        putus={putus}
        opasitas={opasitas}
        animasi={animasi}
        popup={popup}
      />
    );
  }

  return (
    <JalurKabel
      jejak={jejak}
      fiberType={fiberType}
      warna={warna}
      bobot={bobot}
      putus={putus}
      opasitas={opasitas}
      popup={popup}
    />
  );
}
