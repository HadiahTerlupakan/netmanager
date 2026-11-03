"use client";

import { usePermission } from "@/hooks/use-permission";
import { BarangCatalogPanel } from "./BarangCatalogPanel";
import { JasaCatalogPanel } from "./JasaCatalogPanel";
import {
  INVENTORY_CATALOG_TABS,
  INVENTORY_CATALOG_TAB_READ_PERMISSION,
  type InventoryCatalogTab,
} from "./catalogTabs";

type BarangListProps = {
  /** Tab dari query `?tab=`, sudah divalidasi dan dijaga izinnya oleh server page. */
  activeTab: InventoryCatalogTab;
};

/** Memilih panel tab aktif dan menampilkan hanya tab yang boleh dibaca pengguna. */
export default function BarangList({ activeTab }: BarangListProps) {
  const { hasPermission } = usePermission();
  const visibleTabs = INVENTORY_CATALOG_TABS.filter((tab) =>
    hasPermission(INVENTORY_CATALOG_TAB_READ_PERMISSION[tab]),
  );

  if (activeTab === "jasa") {
    return <JasaCatalogPanel visibleTabs={visibleTabs} />;
  }

  return <BarangCatalogPanel visibleTabs={visibleTabs} />;
}
