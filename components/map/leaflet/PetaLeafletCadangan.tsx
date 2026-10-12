"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";

import { MAP_CONSTANTS, MAP_TILE_URL } from "../map-constants";

export type GayaPeta = "satellite" | "plain";

interface PetaLeafletCadanganProps {
  pusat: [number, number];
  zoom: number;
  gaya: GayaPeta;
  minZoom: number;
  maxZoom: number;
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
 * Kanvas peta Leaflet dengan petak Google.
 *
 * Dipakai setiap layar peta selama API key Maps JavaScript belum terisi,
 * menggantikan lima kanvas OpenLayers berpetak OpenStreetMap yang dulu
 * membuat satu halaman menampilkan dua dunia berbeda.
 *
 * Petaknya masih `mt0.google.com` — endpoint tak resmi yang menjadi alasan
 * migrasi ini ada. Ia bertahan HANYA sebagai cadangan sampai key terpasang,
 * dan dicabut bersama Leaflet di fase terakhir.
 */
export function PetaLeafletCadangan({
  pusat,
  zoom,
  gaya,
  minZoom,
  maxZoom,
  className,
  onKlik,
  ikutiPusat,
  titikPas,
  pemicuPas,
  zoomPas,
  children,
}: PetaLeafletCadanganProps) {
  return (
    <MapContainer
      center={pusat}
      zoom={zoom}
      minZoom={minZoom}
      maxZoom={maxZoom}
      zoomControl={false}
      className={className}
      style={{ width: "100%", height: "100%" }}
    >
      <TileLayer url={MAP_TILE_URL[gaya]} attribution="© Google Maps" />
      <ZoomControl position="topleft" />
      <PerbaikiUkuran />
      {ikutiPusat && <IkutiPusat pusat={pusat} zoom={zoom} />}
      {titikPas && (
        <PasKeTitik
          titik={titikPas}
          pemicu={pemicuPas ?? 0}
          zoomMaks={zoomPas ?? ZOOM_MAKS_PAS}
        />
      )}
      {onKlik && <PenangkapKlik onKlik={onKlik} />}
      {children}
    </MapContainer>
  );
}

/** Meneruskan klik kanvas; Leaflet tidak punya prop untuk ini. */
function PenangkapKlik({
  onKlik,
}: {
  onKlik: (lat: number, lng: number) => void;
}): null {
  useMapEvents({
    click: (e) => onKlik(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

/**
 * Menghitung ulang ukuran kanvas saat wadahnya berubah.
 *
 * Leaflet mengukur wadahnya sekali saat dibuat. Di dalam modal, wadah itu
 * sering belum punya ukuran final pada saat itu — petanya lalu tampil
 * separuh atau kosong sampai ada event resize. Perilaku yang sama pernah
 * diverifikasi di produksi pada versi OpenLayers komponen ini, dan
 * penjaganya ikut dipindahkan ke sini supaya tidak hilang bersama OL.
 */
function PerbaikiUkuran(): null {
  const peta = useMap();

  useEffect(() => {
    // jsdom tidak menyediakan ResizeObserver, dan peta di sana memang tidak
    // punya ukuran untuk dihitung ulang. Dijaga di sini supaya test komponen
    // mana pun yang merender peta tidak perlu tahu soal ini.
    if (typeof ResizeObserver === "undefined") return;

    const wadah = peta.getContainer();
    const pengamat = new ResizeObserver(() => peta.invalidateSize());
    pengamat.observe(wadah);
    return () => pengamat.disconnect();
  }, [peta]);

  return null;
}

/** Memindahkan peta mengikuti koordinat yang berubah dari luar. */
function IkutiPusat({
  pusat,
  zoom,
}: {
  pusat: [number, number];
  zoom: number;
}): null {
  const peta = useMap();
  const [lat, lng] = pusat;

  useEffect(() => {
    // Tidak memperkecil zoom yang sudah diperbesar pemakai; hanya memastikan
    // titik barunya cukup dekat untuk dilihat.
    peta.setView([lat, lng], Math.max(zoom, peta.getZoom()), {
      animate: true,
    });
  }, [peta, lat, lng, zoom]);

  return null;
}

/** Memaskan tampilan agar seluruh titik masuk layar. */
function PasKeTitik({
  titik,
  pemicu,
  zoomMaks,
}: {
  titik: Array<{ lat: number; lng: number }>;
  pemicu: number;
  zoomMaks: number;
}): null {
  const peta = useMap();
  const jumlah = titik.length;

  useEffect(() => {
    if (jumlah === 0) return;
    const batas = L.latLngBounds(titik.map((t) => [t.lat, t.lng]));
    peta.fitBounds(batas, { padding: [50, 50], maxZoom: zoomMaks });
    // Sengaja TIDAK bergantung pada isi `titik`: live-map menyegarkan posisi
    // tiap beberapa detik, dan memaskan ulang setiap kali akan merebut
    // tampilan dari pemakai yang sedang menggeser peta. Hanya jumlah titik
    // dan permintaan eksplisit yang memicunya.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peta, jumlah, pemicu, zoomMaks]);

  return null;
}

/** Batas perbesaran bawaan saat memaskan; satu titik tidak perlu zoom maksimal. */
const ZOOM_MAKS_PAS = 16;

// Leaflet mencari berkas ikon bawaannya relatif terhadap bundel.
if (typeof window !== "undefined") {
  // @ts-expect-error: properti internal Leaflet
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "/images/marker-icon-2x.png",
    iconUrl: "/images/marker-icon.png",
    shadowUrl: "/images/marker-shadow.png",
  });
}

export { MAP_CONSTANTS };
