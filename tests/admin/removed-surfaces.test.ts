import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

const mockNotFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
}));

import { ADMIN_MENU_CONFIG } from "@/lib/menu-config";
import AssetsPage from "@/app/admin/inventory/assets/page";

const expectRetiredPage = async (
  renderPage: () => unknown | Promise<unknown>,
) => {
  await expect(async () => {
    await renderPage();
  }).rejects.toThrow("NEXT_NOT_FOUND");
  expect(mockNotFound).toHaveBeenCalled();
};

/**
 * Restock kini pencatat: setelah disetujui, admin langsung memasukkan barang.
 * Tahap pembelian (link belanja tanpa login, catatan belanja, tanda tangan),
 * daftar tahap, dan kiriman susulan sudah dihapus. Persetujuan tetap ada.
 */
const REMOVED_RESTOCK_SURFACES = [
  "app/belanja",
  "app/api/belanja",
  "app/api/inventory/restock/requests/[id]/purchase-link",
  "app/api/inventory/restock/requests/[id]/purchases",
  "app/admin/inventory/restock/RestockStageList.tsx",
  "app/admin/inventory/restock/RestockPurchaseLinkPanel.tsx",
  "app/admin/inventory/restock/RestockCloseUnpurchasedModal.tsx",
  "app/admin/inventory/restock/restockPurchase.ts",
  "app/admin/inventory/restock/restockProgress.ts",
];

/**
 * Berkas yang masih ada di `path`. Folder kosong dan berkas tersembunyi
 * (mis. .DS_Store) tidak dihitung: Git tidak menyimpan folder, jadi folder
 * lokal yang tertinggal setelah isinya dihapus bukan permukaan yang hidup.
 */
const listRemainingFiles = (path: string): string[] => {
  if (!existsSync(path)) return [];
  if (statSync(path).isFile()) return [path];
  return readdirSync(path)
    .filter((entry) => !entry.startsWith("."))
    .flatMap((entry) => listRemainingFiles(join(path, entry)));
};

describe("removed admin surfaces", () => {
  it("does not expose assets in main menu config", () => {
    const inventoryMenu = ADMIN_MENU_CONFIG.find(
      (item) => item.code === "INVENTORY",
    );
    const assetMenu = inventoryMenu?.children?.find(
      (item) => item.path === "/admin/inventory/assets",
    );

    expect(assetMenu).toBeUndefined();
  });

  it("removes truly dormant procurement internals that no longer have live imports", () => {
    expect(existsSync("app/admin/procurement/ProcurementIndexClient.tsx")).toBe(
      false,
    );
    expect(
      existsSync(
        "app/admin/procurement/purchase-orders/_components/PurchaseRequestTab.tsx",
      ),
    ).toBe(false);
    expect(
      existsSync(
        "app/admin/procurement/purchase-orders/_components/PurchaseOrderForm.tsx",
      ),
    ).toBe(false);
    expect(
      existsSync(
        "app/admin/procurement/purchase-orders/_components/ReceiveGoodsModal.tsx",
      ),
    ).toBe(false);
    expect(
      existsSync(
        "app/admin/procurement/suppliers/_components/SupplierForm.tsx",
      ),
    ).toBe(false);
  });

  it("retires the inventory assets page", async () => {
    await expectRetiredPage(() => AssetsPage());
  });

  it.each(REMOVED_RESTOCK_SURFACES)(
    "removes the retired restock surface %s",
    (surface) => {
      expect(listRemainingFiles(surface)).toEqual([]);
    },
  );
});
