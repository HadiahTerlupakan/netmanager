// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("@/components/customer/CustomerAuthProvider", () => ({
  useCustomerAuth: () => ({ isLoading: false, isAuthenticated: true }),
}));

const packageResponse = vi.hoisted(() => ({
  status: "AKTIF",
}));

vi.mock("@/lib/hooks/useApi", () => ({
  useApi: () => ({
    data: {
      package: {
        nama: "Home 10M",
        harga: 150000,
        durasi: 1,
        durasiUnit: "BULAN",
        bandwidth: null as null,
      },
      subscription: {
        jatuhTempo: "2026-11-10T00:00:00.000Z",
        status: packageResponse.status,
      },
      pendingUpgrade: null as null,
      upgradeOptions: [
        {
          id: "paket-20m",
          nama: "Home 20M",
          harga: 200000,
          durasi: 1,
          durasiUnit: "BULAN",
          isFeatured: true,
          priceDifference: 50000,
          bandwidth: null as null,
        },
      ],
    },
    isLoading: false,
    refetch: vi.fn(),
  }),
}));

import CustomerUpgradePackagePage from "@/app/(customer)/upgrade-paket/page";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Server menolak upgrade bila status pelanggan bukan AKTIF. Halaman ini bisa
 * dibuka langsung lewat URL, jadi tombolnya sendiri juga harus ikut tertutup.
 */
describe("halaman upgrade paket: status layanan", () => {
  let root: Root;
  let container: HTMLDivElement;

  async function renderWithStatus(status: string) {
    packageResponse.status = status;
    await act(async () => root.render(<CustomerUpgradePackagePage />));
  }

  function submitButton() {
    return Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("Ajukan Upgrade"),
    );
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("tombol ajukan aktif saat layanan aktif", async () => {
    await renderWithStatus("AKTIF");
    expect(submitButton()?.disabled).toBe(false);
  });

  it("tombol ajukan nonaktif beserta alasannya saat layanan diisolir", async () => {
    await renderWithStatus("ISOLIR");
    expect(submitButton()?.disabled).toBe(true);
    expect(container.textContent).toContain(
      "Upgrade paket hanya bisa diajukan saat layanan aktif",
    );
  });
});
