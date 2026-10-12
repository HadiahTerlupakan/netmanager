"use client";

import { HiOutlineMapPin } from "react-icons/hi2";
import { toast } from "react-hot-toast";

import { PenandaUniversal } from "@/components/map/PenandaUniversal";
import { PetaUniversal } from "@/components/map/PetaUniversal";
import { Button } from "@/components/ui/Button";
import { clientLogger } from "@/lib/client-logger";

interface MapPickerProps {
  latitude: string;
  longitude: string;
  onChange: (lat: string, lng: string) => void;
  label?: string;
}

const ZOOM_TERPILIH = 16;
const ZOOM_AWAL = 13;
const DESIMAL_KOORDINAT = 6;

/** Monas; dipakai saat site belum punya koordinat. */
const PUSAT_BAWAAN = { lat: -6.2, lng: 106.816666 };

/**
 * Memilih lokasi sebuah site Work Order.
 *
 * Koordinatnya berupa string karena itulah bentuk yang dipakai form site
 * (`SiteForm.tsx`) — dibiarkan apa adanya supaya perubahan ini tidak merembet
 * ke validasi dan penyimpanan form itu.
 */
export default function MapPicker({
  latitude,
  longitude,
  onChange,
  label = "Lokasi di Peta",
}: MapPickerProps) {
  const lat = Number.parseFloat(latitude);
  const lng = Number.parseFloat(longitude);
  const adaKoordinat = Number.isFinite(lat) && Number.isFinite(lng);
  const posisi = adaKoordinat ? { lat, lng } : PUSAT_BAWAAN;

  const pilih = (latBaru: number, lngBaru: number) => {
    onChange(
      latBaru.toFixed(DESIMAL_KOORDINAT),
      lngBaru.toFixed(DESIMAL_KOORDINAT),
    );
  };

  // Kegagalannya dilaporkan lewat toast, bukan `alert`: dialog bawaan browser
  // membekukan seluruh halaman sampai ditutup, dan di dalam modal pemilih
  // site itu menutupi peta yang sedang dipakai.
  const ambilLokasiSaatIni = () => {
    if (!navigator.geolocation) {
      toast.error("Browser ini tidak mendukung deteksi lokasi.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (posisiPerangkat) => {
        pilih(
          posisiPerangkat.coords.latitude,
          posisiPerangkat.coords.longitude,
        );
      },
      (error) => {
        clientLogger.error("Gagal mendapatkan lokasi:", error);
        toast.error(
          "Gagal mendapatkan lokasi. Pastikan izin lokasi diaktifkan.",
        );
      },
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {label}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={ambilLokasiSaatIni}
        >
          <HiOutlineMapPin className="h-4 w-4 mr-1" />
          Lokasi Saat Ini
        </Button>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Klik pada peta untuk memilih titik lokasi, atau geser penandanya.
      </p>

      <div className="relative w-full h-[400px] rounded-lg overflow-hidden border border-gray-300 dark:border-gray-700 isolate">
        <PetaUniversal
          pusat={posisi}
          zoom={adaKoordinat ? ZOOM_TERPILIH : ZOOM_AWAL}
          onKlik={pilih}
          ikutiPusat
        >
          {adaKoordinat && (
            <PenandaUniversal
              posisi={posisi}
              type="pole"
              ragam="sementara"
              title="Geser untuk menyesuaikan titik"
              onPindah={pilih}
            />
          )}
        </PetaUniversal>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400">
        <div>
          Lat:{" "}
          <span className="font-mono text-gray-700 dark:text-gray-300">
            {latitude || "-"}
          </span>
        </div>
        <div>
          Lng:{" "}
          <span className="font-mono text-gray-700 dark:text-gray-300">
            {longitude || "-"}
          </span>
        </div>
      </div>
    </div>
  );
}
