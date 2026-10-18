"use client";
import { useState } from "react";
import {
  HiOutlineMapPin,
  HiOutlineUsers,
  HiOutlineArrowPath,
  HiMagnifyingGlass,
  HiOutlineMap,
  HiOutlineSquares2X2,
  HiOutlineExclamationTriangle,
} from "react-icons/hi2";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { Button } from "@/components/ui/Button";
import dynamic from "next/dynamic";
import { LiveLocationCard } from "./LiveLocationCard";
import { useLiveLocations } from "./useLiveLocations";

// Dynamic import untuk Map component (OpenLayers needs client-side only)
const EmployeeLocationMap = dynamic(
  () => import("@/components/attendance/EmployeeLocationMap"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[500px] bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse flex items-center justify-center">
        <span className="text-gray-400 dark:text-gray-500">Memuat peta...</span>
      </div>
    ),
  },
);

export default function LiveMapClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"map" | "cards">("map"); // Default to map view

  const {
    locations,
    lastUpdated,
    isLoading: loading,
    isFetching: isRefreshing,
    error: fetchError,
    refetch,
  } = useLiveLocations();
  const error = fetchError
    ? fetchError.message || "Gagal mengambil lokasi"
    : null;

  const fetchLocations = () => {
    void refetch();
  };

  const trackingOffCount = locations.filter((loc) => loc.trackingOff).length;

  // Filter locations by search
  const filteredLocations = locations.filter(
    (loc) =>
      loc.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.siteName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      loc.departmentName?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <HiOutlineMapPin className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Live Tracking - Lokasi Karyawan
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Pantau lokasi karyawan yang sedang aktif bekerja secara real-time
            </p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            {/* View Toggle */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setViewMode("map")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  viewMode === "map"
                    ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700/50"
                }`}
              >
                <HiOutlineMap className="w-4 h-4" />
                Map
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  viewMode === "cards"
                    ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700/50"
                }`}
              >
                <HiOutlineSquares2X2 className="w-4 h-4" />
                Cards
              </button>
            </div>
            {/* Stats Badge */}
            <div className="flex items-center gap-2 bg-blue-100 dark:bg-blue-900/30 px-4 py-2 rounded-full">
              <HiOutlineUsers className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="font-semibold text-blue-800 dark:text-blue-200">
                {locations.length} Aktif
              </span>
            </div>
            {trackingOffCount > 0 && (
              <div className="flex items-center gap-2 bg-red-100 dark:bg-red-900/30 px-4 py-2 rounded-full">
                <HiOutlineExclamationTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <span className="font-semibold text-red-800 dark:text-red-200">
                  {trackingOffCount} Tracking mati
                </span>
              </div>
            )}

            <Button onClick={fetchLocations} disabled={isRefreshing}>
              <HiOutlineArrowPath
                className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              {isRefreshing ? "Memuat..." : "Refresh"}
            </Button>
          </div>
        </div>

        {/* Last Updated */}
        {lastUpdated && (
          <p className="text-sm text-gray-400 mt-2">
            Terakhir diperbarui:{" "}
            {formatDistanceToNow(lastUpdated, { addSuffix: true, locale: id })}
          </p>
        )}
      </div>

      {/* Search Bar */}
      <div className="mb-6 relative">
        <HiMagnifyingGlass className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Cari karyawan, site, atau departemen..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Map View */}
      {viewMode === "map" && (
        <div className="mb-6">
          {loading && filteredLocations.length === 0 ? (
            <div className="h-[500px] bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse flex items-center justify-center border border-gray-100 dark:border-gray-700">
              <span className="text-gray-400 dark:text-gray-500">
                Memuat lokasi karyawan...
              </span>
            </div>
          ) : filteredLocations.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-12 text-center border border-gray-100 dark:border-gray-700">
              <HiOutlineUsers className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">
                {searchQuery
                  ? "Tidak Ada Hasil"
                  : error
                    ? "Gagal Memuat Data"
                    : "Tidak Ada Karyawan Aktif"}
              </h3>
              <p className="text-gray-400 dark:text-gray-500">
                {searchQuery
                  ? "Coba ubah kata kunci pencarian"
                  : error
                    ? error
                    : "Belum ada karyawan yang check-in hari ini, atau GPS belum terkirim"}
              </p>
            </div>
          ) : (
            <>
              <EmployeeLocationMap locations={filteredLocations} height={500} />
              <WithoutPositionNote locations={filteredLocations} />
            </>
          )}
        </div>
      )}

      {/* Cards View */}
      {viewMode === "cards" && (
        <>
          {/* Employee Cards Grid */}
          {filteredLocations.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-12 text-center border border-gray-100 dark:border-gray-700">
              <HiOutlineUsers className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">
                {loading ? "Memuat..." : "Tidak Ada Karyawan Aktif"}
              </h3>
              <p className="text-gray-400 dark:text-gray-500">
                {loading
                  ? "Mengambil data lokasi..."
                  : "Belum ada karyawan yang check-in hari ini"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredLocations.map((loc) => (
                <LiveLocationCard key={loc.userId} loc={loc} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Karyawan yang bekerja tanpa satu titik pun tidak punya posisi di peta. */
function WithoutPositionNote({
  locations,
}: {
  locations: { userId: string; userName: string; latitude: number | null }[];
}) {
  const withoutPosition = locations.filter((loc) => loc.latitude === null);
  if (withoutPosition.length === 0) return null;
  return (
    <p className="mt-3 text-sm text-red-700 dark:text-red-300">
      Tidak tampil di peta karena belum mengirim lokasi:{" "}
      {withoutPosition.map((loc) => loc.userName).join(", ")}
    </p>
  );
}
