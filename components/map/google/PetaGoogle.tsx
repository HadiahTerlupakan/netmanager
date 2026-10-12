"use client";

import { Map, useMap } from "@vis.gl/react-google-maps";
import { useEffect } from "react";
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
  /** Peta ikut berpindah saat `pusat` berubah dari luar. */
  ikutiPusat?: boolean;
  /** Titik yang harus semuanya masuk layar. */
  titikPas?: Array<{ lat: number; lng: number }>;
  /** Dinaikkan untuk meminta peta dipaskan ulang ke `titikPas`. */
  pemicuPas?: number;
  children?: React.ReactNode;
  /**
   * Peta lama yang dipakai selama API key belum terisi.
   *
   * Ada hanya selama masa migrasi. Tanpa ini, layar yang sudah dipindahkan
   * akan kehilangan petanya sampai administrator menempel key — padahal peta
   * itu hari ini berfungsi. Dengan ini, menempel key cukup untuk membuat
   * setiap layar berganti sendiri, tanpa deploy ulang.
   *
   * Dicabut di fase terakhir bersama Leaflet dan OpenLayers; sejak itu
   * `PetaBelumDikonfigurasi` menjadi satu-satunya keadaan pengganti.
   */
  cadangan?: React.ReactNode;
}

/**
 * Kanvas peta Google untuk seluruh layar peta aplikasi.
 *
 * Satu tempat yang memutuskan apa yang tampil saat API key belum terisi:
 * peta lama bila pemanggil memberi `cadangan` (keadaan selama migrasi), atau
 * panel yang menyebutkan sebabnya bila tidak. Yang tidak pernah terjadi:
 * kotak abu-abu kosong yang tidak bisa dibedakan dari peta rusak atau data
 * yang memang tidak ada.
 */
export function PetaGoogle({
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
  children,
  cadangan,
}: PetaGoogleProps) {
  const { siap, mapId, memuat } = useGoogleMaps();

  // Selama setelan masih diambil, peta cadangan langsung dirender alih-alih
  // kerangka pemuatan: ia sudah bisa dipakai, dan berkedip dari kerangka ke
  // peta lama lalu (mungkin) ke peta Google lebih mengganggu daripada
  // menunggu sebentar.
  if (memuat) {
    if (cadangan) return <>{cadangan}</>;

    return (
      <div
        className={`${className} flex items-center justify-center bg-gray-100 dark:bg-gray-800`}
        data-peta-keadaan="memuat"
      >
        <span className="text-xs text-gray-400">Memuat peta…</span>
      </div>
    );
  }

  if (!siap) {
    if (cadangan) return <>{cadangan}</>;
    return <PetaBelumDikonfigurasi className={className} />;
  }

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
      {ikutiPusat && <IkutiPusat pusat={pusat} zoom={zoom} />}
      {titikPas && <PasKeTitik titik={titikPas} pemicu={pemicuPas ?? 0} />}
      {children}
    </Map>
  );
}

/** Memindahkan peta mengikuti koordinat yang berubah dari luar. */
function IkutiPusat({
  pusat,
  zoom,
}: {
  pusat: { lat: number; lng: number };
  zoom: number;
}): null {
  const peta = useMap();
  const { lat, lng } = pusat;

  useEffect(() => {
    if (!peta) return;
    peta.panTo({ lat, lng });
    // Tidak memperkecil zoom yang sudah diperbesar pemakai.
    const sekarang = peta.getZoom() ?? zoom;
    if (sekarang < zoom) peta.setZoom(zoom);
  }, [peta, lat, lng, zoom]);

  return null;
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

/** Memaskan tampilan agar seluruh titik masuk layar. */
function PasKeTitik({
  titik,
  pemicu,
}: {
  titik: Array<{ lat: number; lng: number }>;
  pemicu: number;
}): null {
  const peta = useMap();
  const jumlah = titik.length;

  useEffect(() => {
    if (!peta || jumlah === 0) return;
    const batas = new google.maps.LatLngBounds();
    for (const satu of titik) batas.extend(satu);
    peta.fitBounds(batas, 50);
    // Sengaja TIDAK bergantung pada isi `titik`: live-map menyegarkan posisi
    // tiap beberapa detik, dan memaskan ulang setiap kali akan merebut
    // tampilan dari pemakai yang sedang menggeser peta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peta, jumlah, pemicu]);

  return null;
}
