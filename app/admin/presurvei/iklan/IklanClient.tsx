"use client";

import Link from "next/link";
import { HiOutlinePlus } from "react-icons/hi2";

import { Button } from "@/components/ui/Button";
import { usePermission } from "@/hooks/use-permission";
import { PERMISSIONS } from "@/lib/permissions";

import { IklanFilters } from "./IklanFilters";
import { IklanTable } from "./IklanTable";
import { useIklanListQuery } from "./useIklanListQuery";

const HALAMAN_PERTAMA = 1;

/** Shell layar daftar kampanye iklan: judul, filter, dan tabel. */
export function IklanClient() {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission(PERMISSIONS.MARKETING.PRESURVEI_IKLAN.CREATE);

  const { filter, ubahFilter, ubahHalaman, baris, meta, isLoading } =
    useIklanListQuery();

  const totalPages = meta?.totalPages ?? HALAMAN_PERTAMA;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Kampanye Iklan
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Kelola kampanye iklan yang menjadi sumber prospek presurvei
          </p>
        </div>
        {canCreate && (
          <Link href="/admin/presurvei/iklan/new">
            <Button>
              <HiOutlinePlus className="h-4 w-4" />
              Kampanye baru
            </Button>
          </Link>
        )}
      </div>

      <IklanFilters filter={filter} onUbah={ubahFilter} />

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <IklanTable
          baris={baris}
          isLoading={isLoading}
          page={filter.page}
          totalPages={totalPages}
          onPageChange={ubahHalaman}
        />
      </div>
    </div>
  );
}
