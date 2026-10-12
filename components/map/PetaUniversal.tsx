"use client";

import dynamic from "next/dynamic";

import { PetaGoogle, type GayaPeta } from "./google/PetaGoogle";
import { MAP_CONSTANTS } from "./map-constants";
import { useMesinPeta } from "./mesin-peta";

/**
 * Leaflet menyentuh `window` saat modulnya dimuat, jadi harus di luar SSR.
 * Dimuat di sini, satu kali, bukan di tiap layar peta.
 */
const PetaLeafletCadangan = dynamic(
  () =>
    import("./leaflet/PetaLeafletCadangan").then(
      (mod) => mod.PetaLeafletCadangan,
    ),
  { ssr: false },
);

interface PetaUniversalProps {
  pusat: { lat: number; lng: number };
  zoom?: number;
  gaya?: GayaPeta;
  minZoom?: number;
  maxZoom?: number;
  className?: string;
  onKlik?: (lat: number, lng: number) => void;
  /** Peta ikut berpindah saat `pusat` berubah dari luar. */
  ikutiPusat?: boolean;
  /** Titik yang harus semuanya masuk layar. */
  titikPas?: Array<{ lat: number; lng: number }>;
  /** Dinaikkan untuk meminta peta dipaskan ulang ke `titikPas`. */
  pemicuPas?: number;
  /** Batas perbesaran saat memaskan; lebih dekat untuk hasil pencarian. */
  zoomPas?: number;
  children?: React.ReactNode;
}

/**
 * Kanvas peta untuk seluruh aplikasi, lepas dari mesin yang dipakai.
 *
 * Google Maps bila API key sudah terisi, Leaflet berpetak Google bila belum.
 * Pemanggilnya tidak perlu tahu yang mana — koordinat, zoom, dan klik ditulis
 * sekali dengan bentuk yang sama.
 *
 * Yang DIHILANGKAN dengan adanya komponen ini: lima kanvas OpenLayers
 * berpetak OpenStreetMap, yang membuat satu halaman yang sama menampilkan
 * peta satelit di satu tab dan peta jalan datar di tab sebelahnya.
 */
export function PetaUniversal({
  pusat,
  zoom = MAP_CONSTANTS.ZOOM.DEFAULT,
  gaya = "satellite",
  minZoom = MAP_CONSTANTS.ZOOM.MIN,
  maxZoom = MAP_CONSTANTS.ZOOM.MAX,
  className = "w-full h-full",
  onKlik,
  ikutiPusat,
  titikPas,
  pemicuPas,
  zoomPas,
  children,
}: PetaUniversalProps) {
  const mesin = useMesinPeta();

  if (mesin === "leaflet") {
    return (
      <PetaLeafletCadangan
        pusat={[pusat.lat, pusat.lng]}
        zoom={zoom}
        gaya={gaya}
        minZoom={minZoom}
        maxZoom={maxZoom}
        className={className}
        onKlik={onKlik}
        ikutiPusat={ikutiPusat}
        titikPas={titikPas}
        pemicuPas={pemicuPas}
        zoomPas={zoomPas}
      >
        {children}
      </PetaLeafletCadangan>
    );
  }

  return (
    <PetaGoogle
      pusat={pusat}
      zoom={zoom}
      gaya={gaya}
      minZoom={minZoom}
      maxZoom={maxZoom}
      className={className}
      onKlik={onKlik}
      ikutiPusat={ikutiPusat}
      titikPas={titikPas}
      pemicuPas={pemicuPas}
      zoomPas={zoomPas}
    >
      {children}
    </PetaGoogle>
  );
}
