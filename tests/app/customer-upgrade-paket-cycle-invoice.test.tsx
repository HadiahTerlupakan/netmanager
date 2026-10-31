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
        status: "AKTIF",
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
    refetch: vi.fn(async () => undefined),
  }),
}));

import CustomerUpgradePackagePage from "@/app/(customer)/upgrade-paket/page";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Halaman menjanjikan harga paket baru mulai siklus berikutnya. Bila tagihan
 * siklus itu sudah terbit, pelanggan harus diberi tahu nominal yang benar-benar
 * ditagih, bukan dibiarkan melihat dua angka yang bertentangan.
 */
describe("halaman upgrade paket: tagihan siklus pertama", () => {
  let root: Root;
  let container: HTMLDivElement;

  async function submitWith(cycleInvoice: Record<string, unknown>) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({
          success: true,
          data: {
            scheduledFor: "2026-11-10T00:00:00.000Z",
            package: { id: "paket-20m", nama: "Home 20M", harga: 200000 },
            cycleInvoice,
          },
        }),
      })),
    );
    await act(async () => root.render(<CustomerUpgradePackagePage />));
    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Ajukan Upgrade"),
    );
    await act(async () => button?.click());
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("tagihan yang diterbitkan ulang menampilkan nominal paket baru", async () => {
    await submitWith({
      status: "REISSUED",
      invoiceId: "inv-baru",
      dueDate: "2026-11-10T00:00:00.000Z",
      totalAmount: 222000,
    });

    expect(container.textContent).toContain(
      "Tagihan jatuh tempo 10 Nov 2026 sudah diperbarui ke harga paket baru",
    );
    expect(container.textContent).toMatch(/Rp\s?222\.000/);
  });

  it("tagihan yang tetap memakai harga lama dijelaskan", async () => {
    await submitWith({
      status: "KEPT",
      invoiceId: "inv-lama",
      dueDate: "2026-11-10T00:00:00.000Z",
      totalAmount: 166500,
    });

    expect(container.textContent).toContain(
      "Tagihan jatuh tempo 10 Nov 2026 sudah terbit",
    );
    expect(container.textContent).toMatch(/Rp\s?166\.500/);
    expect(container.textContent).toContain(
      "harga paket baru berlaku mulai tagihan berikutnya",
    );
  });

  it("tagihan yang belum terbit tidak memunculkan catatan", async () => {
    await submitWith({ status: "NOT_ISSUED_YET" });

    expect(container.textContent).not.toContain("Tagihan jatuh tempo");
  });
});
