"use client";

import { Map } from "@vis.gl/react-google-maps";
import { HiOutlineMapPin } from "react-icons/hi2";

import { useGoogleMaps } from "@/contexts/GoogleMapsContext";

import { MAP_CONSTANTS } from "../map-constants";

export type GayaPeta = "satellite" | "plain";

/**
 * `hybrid`, bukan `satellite`: citra satelit TANPA nama jalan tidak bisa
 * dipakai menyusuri rute kabel, dan itulah satu-satunya alasan peta ini ada.
 */
const TIPE_PETA: Record<GayaPeta, string> = {
  satellite: "hybrid",
  plain: "roadmap",
};

interface PetaGoogleProps {
  pusat: { lat: number; lng: number };
  zoom?: number;
  gaya?: GayaPeta;
  minZoom?: number;
  maxZoom?: number;
  className?: string;
  onKlik?: (lat: number, lng: number) => void;
  children?: React.ReactNode;
}

/**
 * Kanvas peta Google untuk seluruh layar peta aplikasi.
 *
 * Menangani sendiri keadaan "belum dikonfigurasi". Sejak Leaflet dan
 * OpenLayers dicabut tidak ada peta cadangan, jadi instalasi tanpa API key
 * harus mengatakannya — bukan menampilkan kotak abu-abu yang tidak bisa
 * dibedakan dari peta rusak atau data kosong.
 */
export function PetaGoogle({
  pusat,
  zoom = MAP_CONSTANTS.ZOOM.DEFAULT,
  gaya = "satellite",
  minZoom = MAP_CONSTANTS.ZOOM.MIN,
  maxZoom = MAP_CONSTANTS.ZOOM.MAX,
  className = "w-full h-full",
  onKlik,
  children,
}: PetaGoogleProps) {
  const { siap, mapId, memuat } = useGoogleMaps();

  if (memuat) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-gray-100 dark:bg-gray-800`}
        data-peta-keadaan="memuat"
      >
        <span className="text-xs text-gray-400">Memuat peta…</span>
      </div>
    );
  }

  if (!siap) return <PetaBelumDikonfigurasi className={className} />;

  return (
    <Map
      mapId={mapId}
      defaultCenter={pusat}
      defaultZoom={zoom}
      minZoom={minZoom}
      maxZoom={maxZoom}
      mapTypeId={TIPE_PETA[gaya]}
      disableDefaultUI
      zoomControl
      gestureHandling="greedy"
      className={className}
      onClick={(e) => {
        const posisi = e.detail.latLng;
        if (posisi && onKlik) onKlik(posisi.lat, posisi.lng);
      }}
    >
      {children}
    </Map>
  );
}

/**
 * Panel pengganti saat API key belum diisi.
 *
 * Sengaja menyebut tempat mengisinya. Tanpa itu, satu-satunya gejala yang
 * terlihat pemakai adalah peta yang hilang, dan tidak ada cara menebak
 * sebabnya dari layar.
 */
export function PetaBelumDikonfigurasi({ className }: { className?: string }) {
  return (
    <div
      className={`${className} flex flex-col items-center justify-center gap-2 border border-dashed border-gray-300 bg-gray-50 p-6 text-center dark:border-gray-600 dark:bg-gray-800/60`}
      data-peta-keadaan="belum-dikonfigurasi"
    >
      <HiOutlineMapPin className="h-8 w-8 text-gray-300 dark:text-gray-600" />
      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
        Peta belum dikonfigurasi
      </p>
      <p className="max-w-sm text-xs text-gray-400 dark:text-gray-500">
        Google Maps API key belum diisi. Buka Pengaturan → API untuk mengisinya;
        koordinat tetap bisa diketik manual sementara itu.
      </p>
    </div>
  );
}
