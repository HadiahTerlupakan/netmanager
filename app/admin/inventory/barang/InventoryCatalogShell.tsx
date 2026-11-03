"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { InventoryStats } from "@/components/inventory/InventoryStats";
import {
  INVENTORY_CATALOG_TAB_LABEL,
  buildInventoryCatalogTabHref,
  type InventoryCatalogTab,
} from "./catalogTabs";

/** Kelas tombol aksi header, dipakai bersama tombol "Tambah Barang" dan "Tambah Jasa". */
export const CATALOG_HEADER_ACTION_CLASS =
  "inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900";

const TAB_SUBTITLE: Record<InventoryCatalogTab, string> = {
  barang: "Kelola daftar barang dan stok inventory",
  jasa: "Kelola daftar item jasa non-fisik untuk pengajuan restock",
};

const TAB_LIST_HEADING: Record<InventoryCatalogTab, string> = {
  barang: "Daftar Barang",
  jasa: "Daftar Jasa",
};

const TAB_ACTIVE_CLASS =
  "border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400";
const TAB_IDLE_CLASS =
  "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-200";

type InventoryCatalogShellProps = {
  activeTab: InventoryCatalogTab;
  visibleTabs: readonly InventoryCatalogTab[];
  /** Aksi header milik tab aktif; `null` bila pengguna tak berizin membuat. */
  headerAction: ReactNode;
  children: ReactNode;
};

/** Kerangka halaman katalog: header, statistik bersama, tab, dan kartu daftar tab aktif. */
export function InventoryCatalogShell({
  activeTab,
  visibleTabs,
  headerAction,
  children,
}: InventoryCatalogShellProps) {
  // /api/inventory/stats menuntut barang:read, izin yang sama dengan tab barang;
  // pengguna jasa-saja tidak boleh melihat kartu nol palsu dari respons 403.
  const canViewStats = visibleTabs.includes("barang");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Manajemen Barang
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {TAB_SUBTITLE[activeTab]}
          </p>
        </div>
        {headerAction}
      </div>

      {canViewStats && <InventoryStats />}

      {visibleTabs.length > 1 && (
        <InventoryCatalogTabs activeTab={activeTab} visibleTabs={visibleTabs} />
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {TAB_LIST_HEADING[activeTab]}
          </h2>
        </div>
        {children}
      </div>
    </div>
  );
}

function InventoryCatalogTabs({
  activeTab,
  visibleTabs,
}: Pick<InventoryCatalogShellProps, "activeTab" | "visibleTabs">) {
  return (
    <nav
      aria-label="Jenis katalog"
      className="border-b border-gray-200 dark:border-gray-700"
    >
      <ul className="-mb-px flex gap-8">
        {visibleTabs.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <li key={tab}>
              <Link
                href={buildInventoryCatalogTabHref(tab)}
                scroll={false}
                aria-current={isActive ? "page" : undefined}
                className={`inline-block border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
                  isActive ? TAB_ACTIVE_CLASS : TAB_IDLE_CLASS
                }`}
              >
                {INVENTORY_CATALOG_TAB_LABEL[tab]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
