"use client";

import { Polyline, Popup } from "react-leaflet";

import { getFiberColor } from "../map-utils";

interface JalurLeafletCadanganProps {
  /** Sumber → titik belok → tujuan, sudah lengkap. */
  jejak: Array<[number, number]>;
  fiberType?: string | null;
  /** Warna pengganti warna jenis kabel, untuk garis non-kabel. */
  warna?: string;
  bobot: number;
  /** Garis putus-putus: jalur rencana, atau jalur yang sedang digambar. */
  putus?: boolean;
  opasitas?: number;
  /** Garis putus yang mengalir; lihat `.animated-polyline` di components.css. */
  animasi?: boolean;
  popup?: React.ReactNode;
}

/**
 * Satu jalur kabel di peta Leaflet.
 *
 * Pasangan cadangan `JalurUniversal`; dipilih bersama kanvas dan penandanya
 * lewat `useMesinPeta`, karena garis Leaflet di dalam kanvas Google (atau
 * sebaliknya) tidak tampil sama sekali dan tidak melaporkan apa pun.
 */
export function JalurLeafletCadangan({
  jejak,
  fiberType,
  warna,
  bobot,
  putus,
  opasitas = 1,
  animasi,
  popup,
}: JalurLeafletCadanganProps) {
  if (jejak.length < 2) return null;

  return (
    <Polyline
      positions={jejak}
      pathOptions={{
        color: warna ?? getFiberColor(fiberType),
        weight: bobot,
        opacity: opasitas,
        dashArray: putus ? POLA_PUTUS : undefined,
        className: animasi ? "animated-polyline" : undefined,
      }}
    >
      {popup && <Popup>{popup}</Popup>}
    </Polyline>
  );
}

/** Panjang garis dan celahnya; disamakan dengan versi Google. */
const POLA_PUTUS = "10, 10";
