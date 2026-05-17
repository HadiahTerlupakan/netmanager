"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  HiOutlineMapPin,
  HiOutlineArrowLeft,
  HiOutlinePencil,
  HiOutlineUserGroup,
  HiOutlineClipboardDocumentList,
  HiOutlineBuildingStorefront,
  HiOutlineGlobeAlt,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineSignal,
} from "react-icons/hi2";
import PageLoader from "@/components/ui/PageLoader";
import { usePermission } from "@/hooks/use-permission";
import { buttonVariants } from "@/components/ui/Button";
import { useApi } from "@/lib/hooks/useApi";
import { clientLogger } from "@/lib/client-logger";

interface Site {
  id: string;
  code: string;
  name: string;
  description: string | null;
  address: string | null;
  isActive: boolean;
  location: {
    latitude: number | null;
    longitude: number | null;
    attendanceRadius: number;
  };
  stats: {
    userCount: number;
    workOrderCount: number;
    pelangganCount: number;
  };
  users: Array<{
    id: string;
    name: string | null;
    email: string;
    departmentName: string | null;
  }>;
  gudangs: Array<{
    id: string;
    name: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export function SiteDetailClient({ siteId }: { siteId: string }) {
  const { hasPermission } = usePermission();

  const {
    data: site,
    isLoading: loading,
    error: fetchError,
  } = useApi<Site>(`/api/admin/sites/${siteId}`);
  const error = fetchError
    ? fetchError.message || "Kesalahan tidak diketahui"
    : null;

  useEffect(() => {
    if (fetchError) {
      clientLogger.error("Error fetching site detail:", fetchError);
    }
  }, [fetchError]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <PageLoader />
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
        <p className="text-red-600 dark:text-red-400">
          {error || "Site tidak ditemukan"}
        </p>
        <Link
          href="/admin/workorders/sites"
          className="text-blue-600 hover:underline mt-2 inline-block"
        >
          ← Kembali ke Daftar Sites
        </Link>
      </div>
    );
  }

  const hasCoordinate = site.location.latitude && site.location.longitude;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/workorders/sites"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <HiOutlineArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {site.name}
              </h1>
              <span
                className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                  site.isActive
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                }`}
              >
                {site.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
              <span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-sm">
                {site.code}
              </span>
            </p>
          </div>
        </div>

        {hasPermission("site:update") && (
          <Link
            href={`/admin/workorders/sites/${siteId}/edit`}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-400 text-white rounded-lg transition-colors font-medium"
          >
            <HiOutlinePencil className="w-4 h-4 text-white" />
            <span className="text-white">Edit Site</span>
          </Link>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <HiOutlineUserGroup className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {site.stats.userCount}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total Users
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <HiOutlineClipboardDocumentList className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {site.stats.workOrderCount}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Work Orders
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <HiOutlineBuildingStorefront className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {site.gudangs.length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Gudang</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <HiOutlineSignal className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {site.location.attendanceRadius}m
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Radius Absen
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Info & Map Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Site Info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <HiOutlineMapPin className="w-5 h-5 text-gray-500" />
            Informasi Site
          </h2>

          <div className="space-y-4">
            {site.description && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Deskripsi
                </label>
                <p className="text-gray-900 dark:text-white mt-1">
                  {site.description}
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Alamat
              </label>
              <p className="text-gray-900 dark:text-white mt-1">
                {site.address || (
                  <span className="text-gray-400 italic">Belum diisi</span>
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Latitude
                </label>
                <p className="text-gray-900 dark:text-white mt-1 font-mono text-sm">
                  {site.location.latitude || "-"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Longitude
                </label>
                <p className="text-gray-900 dark:text-white mt-1 font-mono text-sm">
                  {site.location.longitude || "-"}
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Status
              </label>
              <div className="flex items-center gap-2 mt-1">
                {site.isActive ? (
                  <>
                    <HiOutlineCheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-green-600 dark:text-green-400">
                      Aktif
                    </span>
                  </>
                ) : (
                  <>
                    <HiOutlineXCircle className="w-5 h-5 text-red-500" />
                    <span className="text-red-600 dark:text-red-400">
                      Tidak Aktif
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Map Link */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <HiOutlineGlobeAlt className="w-5 h-5 text-gray-500" />
            Lokasi Peta
          </h2>

          {hasCoordinate ? (
            <div className="h-[300px] rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex flex-col items-center justify-center">
              <HiOutlineMapPin className="w-16 h-16 text-indigo-500 mb-4" />
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Koordinat tersedia
              </p>
              <a
                href={`https://www.google.com/maps?q=${site.location.latitude},${site.location.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "default" })}
              >
                <HiOutlineGlobeAlt className="w-4 h-4" />
                Buka di Google Maps
              </a>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                {site.location.latitude}, {site.location.longitude}
              </p>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg">
              <div className="text-center text-gray-500 dark:text-gray-400">
                <HiOutlineMapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Koordinat belum diatur</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Users List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <HiOutlineUserGroup className="w-5 h-5 text-gray-500" />
            Daftar User ({site.users.length})
          </h2>
        </div>

        {site.users.length > 0 ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {site.users.map((u) => (
              <div
                key={u.id}
                className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {u.name}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {u.email}
                  </p>
                </div>
                <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">
                  {u.departmentName || "No Department"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            Belum ada user terdaftar di site ini
          </div>
        )}
      </div>

      {/* Gudang List */}
      {site.gudangs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <HiOutlineBuildingStorefront className="w-5 h-5 text-gray-500" />
              Gudang Terhubung ({site.gudangs.length})
            </h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {site.gudangs.map((g) => (
              <div key={g.id} className="p-4 flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <HiOutlineBuildingStorefront className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {g.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
