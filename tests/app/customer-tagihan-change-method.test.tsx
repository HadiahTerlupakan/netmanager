// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
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

vi.mock("@/lib/hooks/useInfiniteApi", () => ({
  useInfiniteApi: () => ({
    items: [
      {
        id: "invoice-1",
        invoiceNumber: "INV-001",
        totalAmount: 11100,
        remainingAmount: 11100,
        status: "SENT",
        dueDate: "2026-11-01T00:00:00.000Z",
        issueDate: "2026-10-01T00:00:00.000Z",
        items: [{ description: "Internet" }],
        lastPayment: {
          amount: 11100,
          method: "OTHER",
          gatewayStatus: "PENDING",
          gatewayProvider: "BC",
          vaNumber: "7007014006305775",
          expiresAt: "2099-01-01T00:00:00.000Z",
        },
      },
    ],
    error: null as Error | null,
    isLoading: false,
    refetch: vi.fn(),
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  }),
}));

vi.mock("@/lib/hooks/useApi", () => ({
  useApi: () => ({
    data: [
      {
        id: "BC",
        name: "BCA Virtual Account",
        provider: "DUITKU",
        type: "VA",
        code: "BC",
        group: "Virtual Account",
      },
      {
        id: "BR",
        name: "BRI Virtual Account",
        provider: "DUITKU",
        type: "VA",
        code: "BR",
        group: "Virtual Account",
      },
    ],
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

/**
 * Duitku tidak bisa menutup VA lebih awal: setelah ganti metode, VA lama tetap
 * bisa dibayar. Pelanggan yang membayar keduanya dulu kehilangan uangnya tanpa
 * pemberitahuan; kini kelebihannya menjadi saldo, dan pelanggan diingatkan
 * untuk membayar yang baru saja.
 */
describe("halaman tagihan pelanggan: ganti metode", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(async () => {
    vi.stubGlobal("EventSource", EventSourcePalsu);
    vi.stubGlobal("fetch", vi.fn());
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () =>
      root.render(
        <ToastProvider>
          <CustomerInvoicesPage />
        </ToastProvider>,
      ),
    );
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("mengingatkan bahwa VA lama masih bisa dibayar", async () => {
    const tombol = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Ganti Metode Pembayaran"),
    )!;
    await act(async () => {
      tombol.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toMatch(/Bayar hanya yang baru/);
    expect(container.textContent).toMatch(/kelebihannya menjadi saldo/);
  });
});
