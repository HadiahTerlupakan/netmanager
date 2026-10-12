"use client";

import { MAP_CONSTANTS } from "../map-constants";
import {
  NODE_ICON_COLORS,
  NODE_ICON_PATH,
  type NodeType,
} from "../map-icon-config";

/**
 * Ikon titik jaringan sebagai komponen React.
 *
 * Menggantikan `createNodeIcon` di `map-icon-factory.ts`, yang merakit HTML
 * sebagai string untuk `L.divIcon` — satu-satunya bentuk yang diterima
 * Leaflet. `AdvancedMarker` menerima `children` React, jadi ikonnya bisa
 * dibaca, diuji, dan diberi properti seperti komponen biasa. Tabel warna dan
 * SVG-nya tetap yang lama (`map-icon-config.ts`), dipakai bersama sampai
 * Leaflet benar-benar dicabut.
 */

export type RagamIkon = "biasa" | "terpilih" | "sementara";

interface IkonNodeProps {
  type: string;
  ragam?: RagamIkon;
  /** Diredupkan untuk node nyata yang hanya menjadi latar peta rencana. */
  redup?: boolean;
  /**
   * Warna pengganti warna tipe node.
   *
   * Untuk penanda yang bukan perangkat jaringan — posisi karyawan di
   * live-map — yang warnanya menyatakan keadaan, bukan jenis perangkat.
   * Saat diisi, lambang tipe node tidak digambar.
   */
  warna?: string;
}

const UKURAN: Record<RagamIkon, number> = {
  biasa: MAP_CONSTANTS.ICON_SIZE.DEFAULT,
  terpilih: MAP_CONSTANTS.ICON_SIZE.SELECTED,
  sementara: MAP_CONSTANTS.ICON_SIZE.TEMP,
};

const BINGKAI: Record<RagamIkon, string> = {
  biasa: MAP_CONSTANTS.BORDER.DEFAULT,
  terpilih: MAP_CONSTANTS.BORDER.SELECTED,
  sementara: MAP_CONSTANTS.BORDER.TEMP,
};

/** Opasitas penanda node nyata di peta rencana; sama dengan versi Leaflet. */
export const OPASITAS_REDUP = 0.4;

const UKURAN_SVG = 16;

/** Warna dan jejak gambar sebuah tipe titik, dengan ODP sebagai cadangan. */
export function rupaNode(type: string) {
  const nodeType = type as NodeType;
  return {
    warna: NODE_ICON_COLORS[nodeType] ?? NODE_ICON_COLORS.odp,
    jejak: NODE_ICON_PATH[nodeType] ?? NODE_ICON_PATH.odp,
  };
}

export function IkonNode({
  type,
  ragam = "biasa",
  redup,
  warna: warnaKustom,
}: IkonNodeProps) {
  const { warna: warnaTipe, jejak } = rupaNode(type);
  const warna = warnaKustom ?? warnaTipe;
  const ukuran = UKURAN[ragam];

  return (
    <div
      data-ikon-node={type}
      data-ragam={ragam}
      style={{
        backgroundColor: warna,
        width: ukuran,
        height: ukuran,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: BINGKAI[ragam],
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        cursor: "pointer",
        opacity: redup ? OPASITAS_REDUP : 1,
      }}
    >
      {!warnaKustom && (
        <svg
          width={UKURAN_SVG}
          height={UKURAN_SVG}
          viewBox="0 0 24 24"
          fill="none"
        >
          <path
            d={jejak}
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      )}
    </div>
  );
}
