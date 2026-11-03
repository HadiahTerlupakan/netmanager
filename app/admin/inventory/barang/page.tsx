import { redirect } from "next/navigation";

import { ensurePermission, hasPermission } from "@/lib/rbac";
import BarangList from "./BarangList";
import {
  INVENTORY_CATALOG_TAB_READ_PERMISSION,
  buildInventoryCatalogTabHref,
  resolveInventoryCatalogTab,
} from "./catalogTabs";

export const dynamic = "force-dynamic";

type BarangPageProps = {
  searchParams: Promise<{ tab?: string | string[] }>;
};

/**
 * Tanpa `?tab`, pengguna yang hanya boleh membaca jasa diarahkan ke tab jasa
 * alih-alih ditolak di tab barang bawaan.
 */
async function shouldRedirectToJasaTab(): Promise<boolean> {
  const canReadBarang = await hasPermission(
    INVENTORY_CATALOG_TAB_READ_PERMISSION.barang,
    undefined,
    { silent: true },
  );
  if (canReadBarang) return false;
  return hasPermission(INVENTORY_CATALOG_TAB_READ_PERMISSION.jasa, undefined, {
    silent: true,
  });
}

/** Halaman katalog inventory; izin baca dijaga per tab aktif (barang:read / jasa:read). */
export default async function BarangPage({ searchParams }: BarangPageProps) {
  const { tab } = await searchParams;
  if (tab === undefined && (await shouldRedirectToJasaTab())) {
    redirect(buildInventoryCatalogTabHref("jasa"));
  }

  const activeTab = resolveInventoryCatalogTab(tab);
  await ensurePermission(INVENTORY_CATALOG_TAB_READ_PERMISSION[activeTab]);

  return <BarangList activeTab={activeTab} />;
}
