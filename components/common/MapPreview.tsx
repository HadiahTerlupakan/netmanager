"use client";

import { PenandaUniversal } from "@/components/map/PenandaUniversal";
import { PetaUniversal } from "@/components/map/PetaUniversal";

type MapPreviewProps = {
  lat?: number | null;
  lon?: number | null;
  height?: number;
};

const TINGGI_BAWAAN = 240;
const ZOOM_PRATINJAU = 17;

/**
 * Pratinjau koordinat pelanggan, hanya-baca.
 *
 * Dulu OpenLayers berpetak OpenStreetMap: peta jalan datar, sementara peta
 * jaringan di layar lain menampilkan citra satelit. Kini memakai kanvas yang
 * sama dengan seluruh aplikasi — Google Maps bila API key terisi, Leaflet
 * berpetak Google bila belum.
 */
export default function MapPreview({
  lat,
  lon,
  height = TINGGI_BAWAAN,
}: MapPreviewProps) {
  // "Tidak ada koordinat" bukan urusan mesin peta mana pun, jadi dijaga di
  // sini — bukan disalin ke tiap implementasi.
  if (typeof lat !== "number" || typeof lon !== "number") {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50"
      >
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Koordinat tidak tersedia
        </div>
      </div>
    );
  }

  const posisi = { lat, lng: lon };

  return (
    <div
      style={{ height, width: "100%", borderRadius: 8, overflow: "hidden" }}
      className="border border-gray-200 dark:border-gray-800"
    >
      <PetaUniversal pusat={posisi} zoom={ZOOM_PRATINJAU}>
        <PenandaUniversal posisi={posisi} type="ont" title="Lokasi pelanggan" />
      </PetaUniversal>
    </div>
  );
}
