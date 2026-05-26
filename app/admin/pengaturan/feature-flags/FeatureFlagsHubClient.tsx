"use client";

import Link from "next/link";
import { useState } from "react";
import { useApi } from "@/lib/hooks/useApi";
import PageLoader from "@/components/ui/PageLoader";
import {
  HiOutlineMagnifyingGlass,
  HiOutlineAdjustmentsHorizontal,
  HiOutlineArrowRight,
  HiOutlineBuildingOffice2,
} from "react-icons/hi2";

interface TenantRow {
  id: string;
  name: string;
  domain?: string | null;
  isActive?: boolean;
}

interface TenantsResponse {
  data?: TenantRow[];
  items?: TenantRow[];
}

/**
 * Hub feature flags — entry point untuk super admin pilih tenant lalu
 * masuk ke halaman feature flags per tenant existing di
 * /admin/tenants/[id]/features.
 */
export function FeatureFlagsHubClient() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useApi<TenantsResponse | TenantRow[]>(
    "/api/admin/tenants",
  );

  const tenants: TenantRow[] = (() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.data)) return data.data;
    return [];
  })();

  const filtered = tenants.filter((t) =>
    [t.name, t.domain ?? ""].some((s) =>
      s.toLowerCase().includes(search.toLowerCase()),
    ),
  );

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Feature Flags
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Aktifkan atau nonaktifkan fitur per tenant. Pilih tenant untuk
          mengelola flag-nya.
        </p>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
        <HiOutlineAdjustmentsHorizontal className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <div className="text-sm text-amber-900 dark:text-amber-200">
          <p className="font-medium">Catatan</p>
          <p className="mt-1 text-amber-700 dark:text-amber-300">
            Mematikan flag akan menyembunyikan menu &amp; route terkait dari
            sidebar tenant. API akan tetap merespon, tapi user tidak bisa
            mengakses lewat UI. Override hanya dapat dilakukan oleh super admin.
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <HiOutlineMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Cari tenant..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Tenant ({filtered.length})
          </h2>
        </div>
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {filtered.map((tenant) => (
            <li key={tenant.id}>
              <Link
                href={`/admin/tenants/${tenant.id}/features`}
                className="flex items-center gap-3 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0">
                  <HiOutlineBuildingOffice2 className="w-5 h-5 text-indigo-700 dark:text-indigo-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {tenant.name}
                  </p>
                  {tenant.domain && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {tenant.domain}
                    </p>
                  )}
                </div>
                {tenant.isActive === false && (
                  <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 rounded">
                    Tidak Aktif
                  </span>
                )}
                <HiOutlineArrowRight className="w-5 h-5 text-gray-400" />
              </Link>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-6 py-12 text-center text-sm text-gray-500">
              Tidak ada tenant yang cocok dengan pencarian.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
