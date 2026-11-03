"use client";

import { Suspense } from "react";
import Link from "next/link";
import { FiPlus } from "react-icons/fi";

import { BarangTable } from "@/components/inventory/BarangTable";
import { usePermission } from "@/hooks/use-permission";
import {
  CATALOG_HEADER_ACTION_CLASS,
  InventoryCatalogShell,
} from "./InventoryCatalogShell";
import type { InventoryCatalogTab } from "./catalogTabs";

type BarangCatalogPanelProps = {
  visibleTabs: readonly InventoryCatalogTab[];
};

/** Tab Barang: tabel barang fisik dengan tombol "Tambah Barang" (barang:create). */
export function BarangCatalogPanel({ visibleTabs }: BarangCatalogPanelProps) {
  const { hasPermission } = usePermission();
  const canCreate = hasPermission("barang:create");

  const headerAction = canCreate ? (
    <Link
      href="/admin/inventory/barang/new"
      className={CATALOG_HEADER_ACTION_CLASS}
    >
      <FiPlus className="h-4 w-4 mr-2 text-white" />
      <span className="text-white">Tambah Barang</span>
    </Link>
  ) : null;

  return (
    <InventoryCatalogShell
      activeTab="barang"
      visibleTabs={visibleTabs}
      headerAction={headerAction}
    >
      <Suspense
        fallback={
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Memuat data barang...
              </p>
            </div>
          </div>
        }
      >
        <BarangTable />
      </Suspense>
    </InventoryCatalogShell>
  );
}
