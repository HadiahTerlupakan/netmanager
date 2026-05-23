import { existsSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

const mockNotFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/navigation", () => ({
  notFound: () => mockNotFound(),
}));

import { ADMIN_MENU_CONFIG } from "@/lib/menu-config";
import ProcurementPage from "@/app/admin/procurement/page";
import MarketPricePage from "@/app/admin/procurement/market-price/page";
import AssetsPage from "@/app/admin/inventory/assets/page";

const expectRetiredPage = async (
  renderPage: () => unknown | Promise<unknown>,
) => {
  await expect(async () => {
    await renderPage();
  }).rejects.toThrow("NEXT_NOT_FOUND");
  expect(mockNotFound).toHaveBeenCalled();
};

describe("removed admin surfaces", () => {
  it("does not expose procurement or assets in main menu config", () => {
    const procurementMenu = ADMIN_MENU_CONFIG.find(
      (item) => item.code === "PROCUREMENT",
    );
    const inventoryMenu = ADMIN_MENU_CONFIG.find(
      (item) => item.code === "INVENTORY",
    );
    const assetMenu = inventoryMenu?.children?.find(
      (item) => item.path === "/admin/inventory/assets",
    );

    expect(procurementMenu).toBeUndefined();
    expect(assetMenu).toBeUndefined();
  });

  it("retires the procurement landing page", async () => {
    await expectRetiredPage(() => ProcurementPage());
  });

  it("retires the market price page", async () => {
    await expectRetiredPage(() => MarketPricePage());
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
});
