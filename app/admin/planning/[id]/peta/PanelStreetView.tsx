"use client";

import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect, useRef, useState } from "react";

type KeadaanPanel = "memuat" | "siap" | "tidak-ada";

interface PanelStreetViewProps {
  posisi: { lat: number; lng: number };
}

/**
 * Radius pencarian panorama terdekat, dalam meter.
 *
 * Titik ODP sering berada di dalam gang atau di atas tiang beberapa meter
 * dari sumbu jalan, sedangkan panorama Google terekam di jalan. Tanpa radius,
 * titik yang sebenarnya terlihat dari jalan akan dilaporkan "tidak ada".
 */
const RADIUS_CARI_METER = 50;

/**
 * Pemandangan jalan pada koordinat satu titik rencana.
 *
 * Inilah alasan peta ini memakai Maps JavaScript API dan bukan sekadar
 * petaknya: tim planning bisa memeriksa tiang dan rute kabel dari jalan
 * tanpa turun ke lapangan dua kali.
 *
 * Pustaka `streetView` dimuat lewat `useMapsLibrary` saat panel ini dirender,
 * jadi halaman yang tidak pernah membukanya tidak membayarnya.
 */
export function PanelStreetView({ posisi }: PanelStreetViewProps) {
  const pustakaStreetView = useMapsLibrary("streetView");
  const wadah = useRef<HTMLDivElement | null>(null);
  const [keadaan, setKeadaan] = useState<KeadaanPanel>("memuat");
  const { lat, lng } = posisi;

  useEffect(() => {
    const elemen = wadah.current;
    if (!pustakaStreetView || !elemen) return;

    let dibatalkan = false;
    const layanan = new pustakaStreetView.StreetViewService();

    layanan.getPanorama(
      { location: { lat, lng }, radius: RADIUS_CARI_METER },
      (data, status) => {
        if (dibatalkan) return;

        // Status bukan-OK adalah hal biasa di gang perumahan, bukan galat:
        // panel menyebutkannya, supaya tidak tertukar dengan peta rusak.
        if (status !== "OK" || !data?.location?.pano) {
          setKeadaan("tidak-ada");
          return;
        }

        new pustakaStreetView.StreetViewPanorama(elemen, {
          pano: data.location.pano,
          visible: true,
          addressControl: false,
          fullscreenControl: false,
          motionTracking: false,
          motionTrackingControl: false,
        });
        setKeadaan("siap");
      },
    );

    return () => {
      dibatalkan = true;
    };
  }, [pustakaStreetView, lat, lng]);

  return (
    <div className="space-y-1" data-panel-street-view={keadaan}>
      <div
        ref={wadah}
        className="h-40 w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700"
      />
      {keadaan !== "siap" && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {keadaan === "memuat"
            ? "Memuat pemandangan jalan…"
            : "Tidak ada pemandangan jalan di sekitar titik ini."}
        </p>
      )}
    </div>
  );
}
