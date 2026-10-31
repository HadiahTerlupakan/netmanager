// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/customer/CustomerNotificationBell", () => ({
  CustomerNotificationBell: (): null => null,
}));

import CustomerDashboardClient, {
  CustomerDashboardContent,
} from "@/app/(customer)/dashboard/CustomerDashboardClient";
import { waitUntil } from "../helpers/portal-dom";

type Billing = {
  outstandingCount: number;
  outstandingAmount: number;
  saldoKredit?: number;
};

function buildSummary(billing: Billing) {
  return {
    profile: {
      state: "ready" as const,
      data: { nama: "Pelanggan Satu", status: "AKTIF", paket: null as null },
    },
    connection: {
      state: "ready" as const,
      data: { isOnline: true, ipAddress: "10.255.0.2" },
    },
    billing: {
      state: "ready" as const,
      data: {
        nearestDueDate: billing.outstandingCount > 0 ? "2026-11-10" : null,
        hasOverdue: false,
        ...billing,
      },
    },
  };
}

function teks(element: Element | null = document.body) {
  return (element?.textContent ?? "").replace(/ /g, " ");
}

function tautan(label: string) {
  return Array.from(document.querySelectorAll("a")).find((a) =>
    a.textContent?.includes(label),
  );
}

describe("kartu tagihan dashboard pelanggan", () => {
  let root: Root;
  let container: HTMLDivElement;

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

  async function render(billing: Billing) {
    await act(async () =>
      root.render(
        <CustomerDashboardContent
          customerId="customer-1"
          customerName="Pelanggan Satu"
          summary={buildSummary(billing)}
          isLoading={false}
          dashboardError={null}
        />,
      ),
    );
  }

  // Jumlahnya mencakup semua bulan yang belum dibayar.
  it("berjudul Total Tagihan, bukan Tagihan Bulan Ini", async () => {
    await render({ outstandingCount: 2, outstandingAmount: 300000 });

    expect(teks()).toContain("Total Tagihan");
    expect(teks()).not.toContain("Bulan Ini");
  });

  it("tanpa tunggakan, Lihat Riwayat membuka /riwayat", async () => {
    await render({ outstandingCount: 0, outstandingAmount: 0 });

    expect(tautan("Lihat Riwayat")?.getAttribute("href")).toBe("/riwayat");
  });

  it("dengan tunggakan, Bayar Sekarang membuka /tagihan", async () => {
    await render({ outstandingCount: 1, outstandingAmount: 150000 });

    expect(tautan("Bayar Sekarang")?.getAttribute("href")).toBe("/tagihan");
  });

  it("tagihan yang seluruhnya ditutup saldo tidak menyuruh membayar Rp 0", async () => {
    await render({ outstandingCount: 1, outstandingAmount: 0 });

    expect(teks()).toContain("Ditutup saldo, sedang diproses");
    expect(tautan("Bayar Sekarang")).toBeUndefined();
    expect(tautan("Lihat Tagihan")?.getAttribute("href")).toBe("/tagihan");
  });

  it("saldo kredit dari ringkasan server ditampilkan", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            success: true,
            data: buildSummary({
              outstandingCount: 1,
              outstandingAmount: 150000,
              saldoKredit: 25000,
            }),
          }),
      })),
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <CustomerDashboardClient
            customerId="customer-1"
            customerName="Pelanggan Satu"
          />
        </QueryClientProvider>,
      ),
    );
    await waitUntil(() => teks().includes("Saldo Anda"));

    expect(teks()).toContain("Saldo Anda Rp 25.000");
  });

  it("tanpa saldo tidak menyebut saldo", async () => {
    await render({ outstandingCount: 1, outstandingAmount: 150000 });

    expect(teks()).not.toContain("Saldo Anda");
  });
});
