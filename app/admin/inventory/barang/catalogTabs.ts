/**
 * Tab katalog inventory di halaman Manajemen Barang: barang fisik dan jasa
 * non-fisik dipisah supaya daftarnya tidak bercampur. Tab aktif dibawa di
 * URL (`?tab=jasa`) agar bisa ditautkan dan bertahan saat halaman dimuat ulang.
 */

export const INVENTORY_CATALOG_TABS = ["barang", "jasa"] as const;

export type InventoryCatalogTab = (typeof INVENTORY_CATALOG_TABS)[number];

export const DEFAULT_INVENTORY_CATALOG_TAB: InventoryCatalogTab = "barang";

export const INVENTORY_CATALOG_TAB_QUERY_KEY = "tab";

export const INVENTORY_CATALOG_BASE_PATH = "/admin/inventory/barang";

/** Izin baca yang sama persis dengan yang dulu menjaga halaman masing-masing. */
export const INVENTORY_CATALOG_TAB_READ_PERMISSION: Record<
  InventoryCatalogTab,
  string
> = {
  barang: "barang:read",
  jasa: "jasa:read",
};

export const INVENTORY_CATALOG_TAB_LABEL: Record<InventoryCatalogTab, string> =
  {
    barang: "Barang",
    jasa: "Jasa",
  };

function isInventoryCatalogTab(value: string): value is InventoryCatalogTab {
  return (INVENTORY_CATALOG_TABS as readonly string[]).includes(value);
}

/** Mengubah nilai query `tab` mentah menjadi tab yang valid; nilai asing jatuh ke tab barang. */
export function resolveInventoryCatalogTab(
  rawTab: string | string[] | undefined,
): InventoryCatalogTab {
  const candidate = Array.isArray(rawTab) ? rawTab[0] : rawTab;
  if (candidate && isInventoryCatalogTab(candidate)) return candidate;
  return DEFAULT_INVENTORY_CATALOG_TAB;
}

/** Membangun URL sebuah tab; tab bawaan memakai URL tanpa query. */
export function buildInventoryCatalogTabHref(tab: InventoryCatalogTab): string {
  if (tab === DEFAULT_INVENTORY_CATALOG_TAB) return INVENTORY_CATALOG_BASE_PATH;
  return `${INVENTORY_CATALOG_BASE_PATH}?${INVENTORY_CATALOG_TAB_QUERY_KEY}=${tab}`;
}
