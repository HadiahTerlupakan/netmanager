// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async () => {
  const { router } = await import("../fixtures/tagihan-page");
  return { useRouter: () => router };
});
vi.mock("@/components/customer/CustomerAuthProvider", () => ({
  useCustomerAuth: () => ({ isLoading: false, isAuthenticated: true }),
}));
vi.mock("@/components/customer/CustomerNotificationBell", () => ({
  CustomerNotificationBell: (): null => null,
}));
vi.mock("@/components/ui/InfiniteScrollSentinel", () => ({
  InfiniteScrollSentinel: (): null => null,
}));
vi.mock("@/lib/hooks/useInfiniteApi", async () => ({
  useInfiniteApi: (await import("../fixtures/tagihan-page"))
    .useInfiniteApiTiruan,
}));
vi.mock("@/lib/hooks/useApi", async () => ({
  useApi: (await import("../fixtures/tagihan-page")).useApiTiruan,
}));

import CustomerInvoicesPage from "@/app/(customer)/tagihan/page";
import { ToastProvider } from "@/components/ui/Toast";
import {
  EventSourceDiam,
  buatInvoice,
  resetTagihanApi,
  tagihanApi,
} from "../fixtures/tagihan-page";
import {
  click,
  findButton,
  flushPromises,
  getButton,
  jsonResponse,
} from "../helpers/portal-dom";

function teks(element: Element | null = document.body) {
  return (element?.textContent ?? "").replace(/ /g, " ");
}

// Sisa nol karena seluruhnya dipotong saldo kredit; status belum PAID
// selama pelunasannya diproses.
const DITUTUP_SALDO = buatInvoice({
  id: "inv-saldo",
  invoiceNumber: "INV-SALDO",
  totalAmount: 0,
  remainingAmount: 0,
});

describe("halaman tagihan pelanggan: ringkasan dan saldo", () => {
  let root: Root;
  let container: HTMLDivElement;
  const fetchMock = vi.fn();

  async function render() {
    await act(async () =>
      root.render(
        <ToastProvider>
          <CustomerInvoicesPage />
        </ToastProvider>,
      ),
    );
  }

  beforeEach(() => {
    resetTagihanApi();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      jsonResponse({ success: true, data: { paymentUrl: null } }),
    );
    vi.stubGlobal("EventSource", EventSourceDiam);
    vi.stubGlobal("fetch", fetchMock);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  // Ringkasan menjumlahkan semua bulan yang belum dibayar.
  it("berjudul Total Tagihan, bukan Tagihan Bulan Ini", async () => {
    tagihanApi.invoices = [buatInvoice()];
    await render();

    expect(teks()).toContain("Total Tagihan");
    expect(teks()).not.toContain("Bulan Ini");
  });

  it("menampilkan saldo kredit yang akan memotong tagihan berikutnya", async () => {
    tagihanApi.invoices = [buatInvoice()];
    tagihanApi.saldoKredit = 25000;
    await render();

    expect(teks()).toContain("Saldo Anda Rp 25.000");
    expect(teks()).toContain("otomatis memotong tagihan berikutnya");
  });

  it("tanpa saldo tidak menyebut saldo", async () => {
    tagihanApi.invoices = [buatInvoice()];
    tagihanApi.saldoKredit = 0;
    await render();

    expect(teks()).not.toContain("Saldo Anda");
  });

  it("tagihan Rp 0 yang belum lunas tampil ditutup saldo, bukan Belum Bayar Rp 0", async () => {
    tagihanApi.invoices = [DITUTUP_SALDO];
    await render();

    const baris = Array.from(document.querySelectorAll("section div")).find(
      (div) => div.textContent?.includes("INV-SALDO"),
    )!;
    const isi = teks(baris.closest("section")!);
    expect(isi).toContain("Ditutup saldo");
    expect(isi).not.toContain("Belum Bayar");
    expect(isi).not.toContain("Rp 0");
    expect(findButton("Bayar Sekarang")).toBeUndefined();
  });

  it("tagihan yang ditutup saldo tidak ikut dibayar", async () => {
    tagihanApi.invoices = [DITUTUP_SALDO, buatInvoice({ id: "inv-1" })];
    await render();

    await click(getButton("Bayar Sekarang"));
    expect(teks()).toContain("Total Tagihan (1 item)");
    await click(document.querySelector<HTMLInputElement>('input[value="BC"]')!);
    await click(getButton("Konfirmasi & Bayar"));
    await flushPromises();

    const [, init] = fetchMock.mock.calls.find(
      ([url]) => url === "/api/customer/payments",
    )!;
    expect(JSON.parse(String(init.body)).invoiceIds).toEqual(["inv-1"]);
  });

  // Pelunasan oleh saldo bukan pembayaran pelanggan: memantaunya lewat SSE
  // memunculkan "Pembayaran Berhasil Rp 0" saat tagihan itu diproses.
  it("hanya tagihan yang harus dibayar yang dipantau", async () => {
    const dipantau: string[] = [];
    vi.stubGlobal(
      "EventSource",
      class {
        onmessage: ((event: MessageEvent) => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(url: string) {
          dipantau.push(url);
        }
        close() {}
      },
    );
    tagihanApi.invoices = [DITUTUP_SALDO, buatInvoice({ id: "inv-1" })];
    await render();

    expect(dipantau).toEqual(["/api/customer/payments/sse?invoiceId=inv-1"]);
  });
});
