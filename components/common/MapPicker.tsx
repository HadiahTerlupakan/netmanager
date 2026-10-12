"use client";

import { useState } from "react";

import { PenandaUniversal } from "@/components/map/PenandaUniversal";
import { PetaUniversal } from "@/components/map/PetaUniversal";

type MapPickerProps = {
  lat?: number | null;
  lon?: number | null;
  height?: number | undefined;
  onChange: (lat: number, lon: number) => void;
};

const TINGGI_BAWAAN = 360;
const ZOOM_TERPILIH = 17;
const ZOOM_AWAL = 14;

/** Monas; dipakai saat belum ada koordinat sama sekali. */
const PUSAT_BAWAAN = { lat: -6.2, lng: 106.816666 };

/** Enam desimal ≈ 11 cm; lebih dari itu hanya derau GPS. */
const DESIMAL_KOORDINAT = 6;

function bulatkan(nilai: number): number {
  return Number(nilai.toFixed(DESIMAL_KOORDINAT));
}

/**
 * Memilih satu koordinat dengan mengklik peta atau menyeret penandanya.
 *
 * Dulu OpenLayers berpetak OpenStreetMap: ~240 baris pengelolaan layer,
 * feature, dan style secara imperatif, ditambah `CustomEvent` global
 * `mappicker-set` untuk memberi tahu peta bahwa koordinatnya berubah dari
 * luar. Semua itu hilang karena koordinatnya kini cukup mengalir sebagai
 * prop, dan petanya mengikutinya lewat `ikutiPusat`.
 */
export default function MapPicker({
  lat,
  lon,
  height = TINGGI_BAWAAN,
  onChange,
}: MapPickerProps) {
  const adaKoordinat = typeof lat === "number" && typeof lon === "number";
  const posisi = adaKoordinat ? { lat, lng: lon } : PUSAT_BAWAAN;

  const pilih = (latBaru: number, lngBaru: number) => {
    onChange(bulatkan(latBaru), bulatkan(lngBaru));
  };

  return (
    <div style={{ height, width: "100%", borderRadius: 8, overflow: "hidden" }}>
      <PetaUniversal
        pusat={posisi}
        zoom={adaKoordinat ? ZOOM_TERPILIH : ZOOM_AWAL}
        onKlik={pilih}
        ikutiPusat
      >
        {adaKoordinat && (
          <PenandaUniversal
            posisi={posisi}
            type="ont"
            ragam="sementara"
            title="Geser untuk menyesuaikan titik"
            onPindah={pilih}
          />
        )}
      </PetaUniversal>
    </div>
  );
}

/**
 * `MapPicker` dengan pencarian alamat.
 *
 * Koordinat hasil pencarian diteruskan sebagai state biasa; peta
 * mengikutinya sendiri, tanpa `CustomEvent` global seperti versi lama.
 */
export function MapPickerWithSearch(props: MapPickerProps) {
  const [lat, setLat] = useState<number | null>(props.lat ?? null);
  const [lon, setLon] = useState<number | null>(props.lon ?? null);

  return (
    <MapPicker
      lat={lat}
      lon={lon}
      height={props.height}
      onChange={(la, lo) => {
        setLat(la);
        setLon(lo);
        props.onChange(la, lo);
      }}
    />
  );
}
