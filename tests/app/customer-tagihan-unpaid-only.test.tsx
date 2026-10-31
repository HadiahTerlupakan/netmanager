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

vi.mock("@/components/customer/CustomerNotificationBell", () => ({
  CustomerNotificationBell: (): null => null,
}));

vi.mock("@/components/ui/InfiniteScrollSentinel", () => ({
  InfiniteScrollSentinel: (): null => null,
}));

const invoiceList = vi.hoisted(() => ({
  items: [] as Array<Record<string, unknown>>,
  requestedUrl: null as string | null,
}));

vi.mock("@/lib/hooks/useInfiniteApi", () => ({
  useInfiniteApi: (url: string | null) => {
    invoiceList.requestedUrl = url;
    return {
      items: invoiceList.items,
      error: null as Error | null,
      isLoading: false,
      refetch: vi.fn(),
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    };
  },
}));

vi.mock("@/lib/hooks/useApi", () => ({
  useApi: () => ({
    data: [] as unknown[],
    error: null as Error | null,
    isLoading: false,
  }),
}));

import CustomerInvoicesPage from "@/app/(customer)/tagihan/page";
import { ToastProvider } from "@/components/ui/Toast";

class EventSourcePalsu {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close() {}
}

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function buatInvoice(invoiceNumber: string, status: string) {
  return {
    id: invoiceNumber,
    invoiceNumber,
    totalAmount: 150000,
    remainingAmount: 150000,
    status,
    dueDate: "2026-11-10T00:00:00.000Z",
    issueDate: "2026-10-10T00:00:00.000Z",
    items: [{ description: "Internet 20 Mbps" }],
  };
}

/**
 * Halaman bayar dulu memuat seluruh riwayat tagihan di bawah tombol bayar,
 * sehingga halamannya memanjang terus. Sekarang /tagihan hanya menampilkan
 * yang akan dibayar; riwayat lengkap ada di /riwayat, seperti di aplikasi.
 */
describe("halaman tagihan pelanggan: hanya tagihan yang belum dibayar", () => {
  let root: Root;
  let container: HTMLDivElement;

  async function render() {
    await act(async () =>
      root.render(
        <ToastProvider>
          <CustomerInvoicesPage />
        </ToastProvider>,
      ),
    );
  }

  function linkRiwayat() {
    return Array.from(container.querySelectorAll("a")).find((a) =>
      a.textContent?.includes("Riwayat Tagihan & Pembayaran"),
    );
  }

  beforeEach(() => {
    vi.stubGlobal("EventSource", EventSourcePalsu);
    vi.stubGlobal("fetch", vi.fn());
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("menampilkan tagihan terbuka saja dan menautkan ke riwayat", async () => {
    invoiceList.items = [
      buatInvoice("INV-SENT", "SENT"),
      buatInvoice("INV-LUNAS", "PAID"),
      buatInvoice("INV-BATAL", "CANCELLED"),
      buatInvoice("INV-SEBAGIAN", "PARTIAL_PAID"),
    ];
    await render();

    expect(container.textContent).toContain("INV-SENT");
    expect(container.textContent).toContain("INV-SEBAGIAN");
    expect(container.textContent).not.toContain("INV-LUNAS");
    expect(container.textContent).not.toContain("INV-BATAL");
    expect(container.textContent).not.toContain("Unduh Semua");
    expect(linkRiwayat()?.getAttribute("href")).toBe("/riwayat");
  });

  it("meminta server hanya tagihan terbuka, agar tidak ada yang tertinggal di halaman berikutnya", async () => {
    invoiceList.items = [buatInvoice("INV-SENT", "SENT")];
    await render();

    const url = new URL(invoiceList.requestedUrl!, "http://localhost");
    expect(url.pathname).toBe("/api/customer/invoices");
    expect(url.searchParams.get("status")?.split(",").sort()).toEqual([
      "OVERDUE",
      "PARTIAL_PAID",
      "SENT",
    ]);
  });

  it("tanpa tagihan terbuka menampilkan keadaan kosong dan tautan riwayat", async () => {
    invoiceList.items = [buatInvoice("INV-LUNAS", "PAID")];
    await render();

    expect(container.textContent).toContain(
      "Tidak ada tagihan yang perlu dibayar",
    );
    expect(container.textContent).not.toContain("INV-LUNAS");
    expect(linkRiwayat()?.getAttribute("href")).toBe("/riwayat");
  });
});
