"use client";
import { clientLogger } from "@/lib/client-logger";

import { useCallback, useEffect, useState } from "react";
import {
  HiOutlineMapPin,
  HiOutlineUsers,
  HiOutlineClock,
  HiOutlineArrowPath,
  HiMagnifyingGlass,
  HiOutlineSignal,
  HiOutlineMap,
  HiOutlineSquares2X2,
} from "react-icons/hi2";
import { formatDistanceToNow, format } from "date-fns";
import { id } from "date-fns/locale";
import { Button } from "@/components/ui/Button";
import { useRealtimeEvent } from "@/lib/realtime/hooks/useRealtimeEvent";
import { useRealtimeScope } from "@/lib/realtime/hooks/useRealtimeScope";
import { useRealtime } from "@/lib/realtime/RealtimeContext";
import { useApi } from "@/lib/hooks/useApi";
import dynamic from "next/dynamic";
import Image from "next/image";

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

interface EmployeeLocation {
  userId: string;
  userName: string;
  userImage: string | null;
  siteName: string | null;
  departmentName: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed?: number | null;
  heading?: number | null;
  isMoving: boolean;
  batteryLevel: number | null;
  recordedAt: string;
  checkInTime: string;
}

function getBatteryPercentage(batteryLevel: number): number {
  return batteryLevel <= 1
    ? Math.round(batteryLevel * 100)
    : Math.round(batteryLevel);
}

export default function LiveMapClient() {
  const { isConnected } = useRealtime();
  const [searchQuery, setSearchQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<"map" | "cards">("map"); // Default to map view

  const {
    data,
    isLoading: loading,
    error: fetchError,
    mutate,
  } = useApi<{ locations?: EmployeeLocation[]; tenantId?: string | null }>(
    "/api/admin/location/live",
    {
      // Polling fallback hanya saat WebSocket terputus.
      // TanStack auto-pause saat tab tidak active.
      refreshInterval: isConnected ? undefined : 15_000,
    },
  );
  const locations = data?.locations ?? [];
  const tenantId = data?.tenantId ?? null;
  const error = fetchError
    ? fetchError.message || "Gagal mengambil lokasi"
    : null;

  useEffect(() => {
    if (data) {
      clientLogger.info("[LiveMapClient] API Response:", data);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastUpdated(new Date());
    }
  }, [data]);

  const fetchLocations = () => mutate();

  useRealtimeScope(
    tenantId ? { kind: "admin", id: `location:${tenantId}` } : null,
  );

  const handleLocationUpdate = useCallback(
    (incoming: EmployeeLocation) => {
      void mutate(
        (prev) => {
          const prevList = prev?.locations ?? [];
          const index = prevList.findIndex((p) => p.userId === incoming.userId);
          if (index === -1) {
            void mutate();
            return prev;
          }
          const newLocations = [...prevList];
          const existingLocation = newLocations[index];
          if (existingLocation) {
            newLocations[index] = {
              ...existingLocation,
              latitude: incoming.latitude,
              longitude: incoming.longitude,
              heading: incoming.heading,
              isMoving: incoming.isMoving,
              batteryLevel: incoming.batteryLevel,
              recordedAt: incoming.recordedAt,
              accuracy: incoming.accuracy,
              speed: incoming.speed,
            };
          }
          return prev ? { ...prev, locations: newLocations } : prev;
        },
        { revalidate: false },
      );
      setLastUpdated(new Date());
    },
    [mutate],
  );

  useRealtimeEvent<EmployeeLocation>(
    "admin.location.update",
    handleLocationUpdate,
  );

  // Filter locations by search
  const safeLocations = Array.isArray(locations) ? locations : [];
  const filteredLocations = safeLocations.filter(
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

            {/* Manual Refresh */}
            <Button onClick={fetchLocations} disabled={loading}>
              <HiOutlineArrowPath
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
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
          <EmployeeLocationMap locations={filteredLocations} height={500} />
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
                <div
                  key={loc.userId}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 hover:shadow-md transition border border-gray-100 dark:border-gray-700"
                >
                  {/* Header with Avatar */}
                  <div className="flex items-center gap-3 mb-4">
                    {loc.userImage ? (
                      <div className="relative w-12 h-12">
                        <Image
                          src={loc.userImage}
                          alt={loc.userName}
                          fill
                          className="rounded-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-linear-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">
                          {loc.userName[0]}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 dark:text-white truncate">
                        {loc.userName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {loc.departmentName || "-"}
                      </p>
                    </div>
                    {loc.isMoving && (
                      <span className="flex items-center gap-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full">
                        <HiOutlineSignal className="w-3 h-3" />
                        Moving
                      </span>
                    )}
                  </div>

                  {/* Location Info */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                      <HiOutlineMapPin className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                      <span className="truncate">
                        {loc.siteName || "Unknown"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                      <HiOutlineClock className="w-4 h-4 text-green-500 dark:text-green-400" />
                      <span>
                        Check-in: {format(new Date(loc.checkInTime), "HH:mm")}
                      </span>
                    </div>

                    {/* Coordinates */}
                    <div className="flex items-center gap-2 text-gray-400 text-xs">
                      <span>
                        📍 {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                      </span>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs text-gray-400">
                    <span>
                      Update:{" "}
                      {formatDistanceToNow(new Date(loc.recordedAt), {
                        addSuffix: true,
                        locale: id,
                      })}
                    </span>
                    {loc.batteryLevel !== null && (
                      <span
                        className={`px-2 py-1 rounded ${
                          getBatteryPercentage(loc.batteryLevel) > 50
                            ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                            : getBatteryPercentage(loc.batteryLevel) > 20
                              ? "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400"
                              : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                        }`}
                      >
                        🔋 {getBatteryPercentage(loc.batteryLevel)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
