"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";

import { PenandaUniversal } from "@/components/map/PenandaUniversal";
import { PetaUniversal } from "@/components/map/PetaUniversal";

interface EmployeeLocation {
  userId: string;
  userName: string;
  userImage: string | null;
  siteName: string | null;
  departmentName: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  speed?: number | null;
  heading?: number | null;
  isMoving: boolean;
  batteryLevel: number | null;
  recordedAt: string | null;
  checkInTime: string;
  trackingOff?: boolean;
}

type PositionedLocation = EmployeeLocation & {
  latitude: number;
  longitude: number;
  recordedAt: string;
};

interface EmployeeLocationMapProps {
  locations: EmployeeLocation[];
  height?: number | string;
  onEmployeeClick?: (employee: EmployeeLocation) => void;
}

const WARNA_BERGERAK = "#22c55e";
const WARNA_DIAM = "#2563eb";
const WARNA_TRACKING_MATI = "#dc2626";

/** Monas; dipakai saat belum ada satu pun karyawan aktif. */
const PUSAT_BAWAAN = { lat: -6.2, lng: 106.816666 };

/**
 * Posisi karyawan yang sedang bertugas.
 *
 * Dulu OpenLayers berpetak OpenStreetMap, dengan popup yang dirakit sebagai
 * string HTML dan di-escape manual untuk mencegah XSS dari nama karyawan.
 * Popup-nya kini JSX biasa, jadi React yang menangani escaping-nya dan
 * fungsi `escapeHtml` buatan sendiri itu tidak diperlukan lagi.
 */
export default function EmployeeLocationMap({
  locations,
  height = 500,
  onEmployeeClick,
}: EmployeeLocationMapProps) {
  const [pemicuPas, setPemicuPas] = useState(0);

  const berposisi = locations.filter(
    (lokasi): lokasi is PositionedLocation =>
      lokasi.latitude !== null &&
      lokasi.longitude !== null &&
      lokasi.recordedAt !== null,
  );
  const titik = berposisi.map((lokasi) => ({
    lat: lokasi.latitude,
    lng: lokasi.longitude,
  }));
  const pusat = titik[0] ?? PUSAT_BAWAAN;

  return (
    <div className="relative">
      <div
        style={{ height, width: "100%", borderRadius: 12, overflow: "hidden" }}
        className="border border-gray-200 dark:border-gray-800"
      >
        <PetaUniversal pusat={pusat} titikPas={titik} pemicuPas={pemicuPas}>
          {berposisi.map((lokasi) => (
            <PenandaUniversal
              key={lokasi.userId}
              posisi={{ lat: lokasi.latitude, lng: lokasi.longitude }}
              type="ont"
              warna={warnaPenanda(lokasi)}
              title={lokasi.userName}
              onKlik={() => onEmployeeClick?.(lokasi)}
              popup={<RingkasanKaryawan lokasi={lokasi} />}
            />
          ))}
        </PetaUniversal>
      </div>

      <div className="absolute bottom-4 left-4 flex flex-col gap-2">
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
            Keterangan
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <span className="w-3 h-3 rounded-full bg-blue-600 dark:bg-blue-500"></span>
            <span>Diam</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mt-1">
            <span className="w-3 h-3 rounded-full bg-green-500 dark:bg-green-400"></span>
            <span>Bergerak</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mt-1">
            <span className="w-3 h-3 rounded-full bg-red-600 dark:bg-red-500"></span>
            <span>Tracking mati</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setPemicuPas((nilai) => nilai + 1)}
          className="bg-white/90 hover:bg-white dark:bg-gray-800/90 dark:hover:bg-gray-800 backdrop-blur-sm text-xs font-medium text-gray-700 dark:text-gray-300 rounded-lg p-2 shadow-lg border border-gray-200 dark:border-gray-700 transition-colors flex items-center justify-center gap-1"
        >
          📍 Pusatkan Peta
        </button>
      </div>

      <div className="absolute top-4 right-4 bg-blue-600 dark:bg-blue-500 text-white px-3 py-1.5 rounded-full text-sm font-semibold shadow-lg">
        {locations.length} Karyawan Aktif
      </div>
    </div>
  );
}

function warnaPenanda(lokasi: EmployeeLocation): string {
  if (lokasi.trackingOff) return WARNA_TRACKING_MATI;
  return lokasi.isMoving ? WARNA_BERGERAK : WARNA_DIAM;
}

/** Isi popup satu karyawan. */
function RingkasanKaryawan({ lokasi }: { lokasi: PositionedLocation }) {
  return (
    <div className="min-w-[180px]">
      <div className="font-semibold text-gray-800 text-sm">
        {lokasi.userName}
      </div>
      <div className="text-xs text-gray-500 mt-1">
        {lokasi.departmentName || "-"}
      </div>
      <div className="text-xs text-blue-600 mt-1">
        {lokasi.siteName || "Tanpa site"}
      </div>
      {lokasi.isMoving && (
        <div className="text-xs text-green-600 mt-1">📍 Bergerak</div>
      )}
      {lokasi.trackingOff && (
        <div className="text-xs font-medium text-red-600 mt-1">
          ⚠ Tracking mati — posisi terakhir
        </div>
      )}
      <div className="text-xs text-gray-400 mt-1">
        Update:{" "}
        {formatDistanceToNow(new Date(lokasi.recordedAt), {
          addSuffix: true,
          locale: id,
        })}
      </div>
    </div>
  );
}
