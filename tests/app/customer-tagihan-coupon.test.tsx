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

const tagihanBelumBayar = [
  {
    id: "invoice-1",
    invoiceNumber: "INV-001",
    totalAmount: 100000,
    remainingAmount: 100000,
    status: "SENT",
    dueDate: "2026-11-01T00:00:00.000Z",
    issueDate: "2026-10-01T00:00:00.000Z",
    items: [{ description: "Internet 20 Mbps" }],
  },
];

vi.mock("@/lib/hooks/useInfiniteApi", () => ({
  useInfiniteApi: () => ({
    items: tagihanBelumBayar,
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
        id: "manual_bank-1",
        name: "BCA",
        provider: "MANUAL",
        type: "MANUAL",
        code: "MANUAL_bank-1",
        group: "Transfer Manual",
      },
    ],
    error: null as Error | null,
    isLoading: false,
  }),
}));

import CustomerInvoicesPage from "@/app/(customer)/tagihan/page";
import { ToastProvider } from "@/components/ui/Toast";

// Halaman memantau status bayar lewat SSE; jsdom tidak punya EventSource.
class EventSourcePalsu {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close() {}
}

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

type FetchCall = [string, RequestInit];

function tombol(container: HTMLElement, label: string) {
  const found = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes(label),
  );
  if (!found) throw new Error(`Tombol "${label}" tidak ditemukan`);
  return found;
}

async function klik(element: HTMLElement) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function ketik(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function bodyPanggilan(fetchMock: ReturnType<typeof vi.fn>, url: string) {
  const call = (fetchMock.mock.calls as FetchCall[]).find(([u]) => u === url);
  return call ? JSON.parse(String(call[1].body)) : undefined;
}

describe("halaman tagihan pelanggan: kupon dan pembayaran", () => {
  let root: Root;
  let container: HTMLDivElement;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.stubGlobal("EventSource", EventSourcePalsu);
    fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async (): Promise<unknown> =>
        url === "/api/customer/coupons/verify"
          ? {
              success: true,
              data: {
                valid: true,
                code: "HEMAT10",
                discountAmount: 10000,
                finalAmount: 90000,
              },
            }
          : { success: true, data: { paymentUrl: null } },
    }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("alert", vi.fn());

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
    await klik(tombol(container, "Bayar Sekarang"));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("memverifikasi kupon lewat endpoint pelanggan dan membaca data.valid", async () => {
    const input = container.querySelector<HTMLInputElement>(
      'input[placeholder="Masukan kode"]',
    )!;
    await ketik(input, "hemat10");
    await klik(tombol(container, "Gunakan"));

    expect(bodyPanggilan(fetchMock, "/api/customer/coupons/verify")).toEqual({
      code: "HEMAT10",
      amount: 100000,
    });
    expect(container.textContent).toContain("Diskon (HEMAT10)");

    await klik(tombol(container, "Konfirmasi & Bayar"));
    expect(bodyPanggilan(fetchMock, "/api/customer/payments")).toMatchObject({
      couponCode: "HEMAT10",
    });
  });

  it("tidak mengirim couponCode null saat membayar tanpa kupon", async () => {
    await klik(tombol(container, "Konfirmasi & Bayar"));

    const body = bodyPanggilan(fetchMock, "/api/customer/payments");
    expect(body.invoiceIds).toEqual(["invoice-1"]);
    expect(body).not.toHaveProperty("couponCode");
  });
});
