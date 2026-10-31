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
  checkoutVa,
  resetTagihanApi,
  router,
  tagihanApi,
} from "../fixtures/tagihan-page";
import {
  click,
  findButton,
  flushPromises,
  getButton,
  jsonResponse,
} from "../helpers/portal-dom";

const KODE_VA = "7007014006305775";

/** Checkout gabungan tiga tagihan Rp 11.100: Duitku menagih Rp 33.300. */
function checkoutTigaTagihan() {
  const checkout = {
    amount: 11100,
    checkoutId: "co-1",
    checkoutTotal: 33300,
    checkoutInvoiceNumbers: ["INV-001", "INV-002", "INV-003"],
  };
  return ["001", "002", "003"].map((nomor, index) =>
    buatInvoice({
      id: `inv-${index + 1}`,
      invoiceNumber: `INV-${nomor}`,
      totalAmount: 11100,
      remainingAmount: 11100,
      lastPayment: checkoutVa({ id: `pay-${index + 1}`, ...checkout }),
    }),
  );
}

function teks(element: Element | null = document.body) {
  return (element?.textContent ?? "").replace(/ /g, " ");
}

function kartuCheckout() {
  return Array.from(document.querySelectorAll("section")).find((section) =>
    /MENUNGGU PEMBAYARAN|KEDALUWARSA/.test(section.textContent ?? ""),
  );
}

function dialog() {
  return document.querySelector<HTMLElement>('[role="dialog"]');
}

describe("halaman tagihan pelanggan: checkout berjalan", () => {
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
    vi.useRealTimers();
  });

  // Duitku menagih jumlah seluruh checkout, tetapi kartu dulu menampilkan
  // nominal invoice pertama sebagai "Nominal yang harus dibayar (tepat)".
  describe("checkout beberapa tagihan", () => {
    it("nominal VA adalah total checkout dan semua tagihannya disebut", async () => {
      tagihanApi.invoices = checkoutTigaTagihan();
      await render();

      const kartu = teks(kartuCheckout()!);
      expect(kartu).toContain("Nominal yang harus dibayar (tepat)");
      expect(kartu).toContain("Rp 33.300");
      expect(kartu).not.toContain("Rp 11.100");
      expect(kartu).toContain("INV-001");
      expect(kartu).toContain("INV-002");
      expect(kartu).toContain("INV-003");
    });

    it("server lama tanpa checkoutTotal tetap memakai nominal payment", async () => {
      tagihanApi.invoices = [buatInvoice({ lastPayment: checkoutVa() })];
      await render();

      expect(teks(kartuCheckout()!)).toContain("Rp 100.000");
    });
  });

  // onExpire inline membuat efek hitung mundur berjalan ulang di setiap
  // render: setelah kedaluwarsa halaman memuat ulang ±38 kali per detik dan
  // tetap menampilkan VA yang sudah mati.
  describe("checkout kedaluwarsa", () => {
    it("menyembunyikan VA lama dan menawarkan pilih metode lagi", async () => {
      tagihanApi.invoices = [
        buatInvoice({
          lastPayment: checkoutVa({ expiresAt: "2020-01-01T00:00:00.000Z" }),
        }),
      ];
      await render();

      const kartu = teks(kartuCheckout()!);
      expect(kartu).toContain("Kode pembayaran ini sudah kedaluwarsa");
      expect(kartu).not.toContain(KODE_VA);
      expect(kartu).not.toContain("Nominal yang harus dibayar (tepat)");

      await click(getButton("Pilih Metode Lagi"));
      expect(teks(dialog())).toContain("Rincian Pembayaran");
    });

    it("habisnya waktu memuat ulang tagihan sekali saja", async () => {
      vi.useFakeTimers();
      tagihanApi.invoices = [
        buatInvoice({
          lastPayment: checkoutVa({
            expiresAt: new Date(Date.now() + 3000).toISOString(),
          }),
        }),
      ];
      await render();
      expect(teks(kartuCheckout()!)).toContain(KODE_VA);

      await act(async () => vi.advanceTimersByTime(4000));
      expect(teks(kartuCheckout()!)).not.toContain(KODE_VA);
      await act(async () => vi.advanceTimersByTime(60_000));

      expect(tagihanApi.refetchInvoices).toHaveBeenCalledTimes(1);
    });
  });

  describe("tombol Saya Sudah Bayar, Cek Status", () => {
    it("menanyakan server, sibuk selama menunggu, lalu menampilkan hasilnya", async () => {
      let jawab: (value: unknown) => void = () => {};
      fetchMock.mockReturnValue(new Promise((resolve) => (jawab = resolve)));
      tagihanApi.invoices = checkoutTigaTagihan();
      await render();

      await click(getButton("Saya Sudah Bayar, Cek Status"));
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/customer/payments/check-status");
      expect(JSON.parse(String(init.body))).toEqual({ invoiceId: "inv-1" });
      const tombol = getButton("Memeriksa");
      expect(tombol.disabled).toBe(true);

      await act(async () =>
        jawab(jsonResponse({ success: true, data: { status: "PENDING" } })),
      );
      await flushPromises();

      expect(teks()).toContain("Pembayaran belum kami terima");
      expect(getButton("Saya Sudah Bayar, Cek Status").disabled).toBe(false);
    });

    it("status PAID menampilkan layar sukses dengan total checkout", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ success: true, data: { status: "PAID" } }),
      );
      tagihanApi.invoices = checkoutTigaTagihan();
      await render();

      await click(getButton("Saya Sudah Bayar, Cek Status"));
      await flushPromises();

      const sukses = dialog();
      expect(teks(sukses)).toContain("Pembayaran Berhasil");
      expect(teks(sukses)).toContain("Rp 33.300");
      expect(tagihanApi.refetchInvoices).toHaveBeenCalled();
    });
  });

  // Gateway menolak checkout baru: dulu muncul toast galat lalu "Metode
  // pembayaran diperbarui..." padahal tidak ada instruksi baru.
  describe("ganti metode yang ditolak gateway", () => {
    it("hanya menampilkan galatnya, memuat ulang, dan checkout lama tetap tampil", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          { success: false, error: "Kanal BRI sedang tidak aktif" },
          502,
        ),
      );
      tagihanApi.invoices = [buatInvoice({ lastPayment: checkoutVa() })];
      await render();

      await click(getButton("Ganti Metode Pembayaran"));
      await click(
        document.querySelector<HTMLInputElement>('input[value="BR"]')!,
      );
      await click(getButton("Konfirmasi & Bayar"));
      await flushPromises();

      expect(teks(dialog()?.querySelector('[role="alert"]') ?? null)).toBe(
        "Kanal BRI sedang tidak aktif",
      );
      expect(tagihanApi.refetchInvoices).toHaveBeenCalled();
      expect(teks()).not.toContain("Metode pembayaran diperbarui");
      expect(teks(kartuCheckout()!)).toContain(KODE_VA);
    });
  });

  describe("layar sukses", () => {
    async function lunasLewatCekStatus() {
      fetchMock.mockResolvedValue(
        jsonResponse({ success: true, data: { status: "PAID" } }),
      );
      tagihanApi.invoices = checkoutTigaTagihan();
      await render();
      await click(getButton("Saya Sudah Bayar, Cek Status"));
      await flushPromises();
    }

    it("Lihat Riwayat membuka /riwayat", async () => {
      await lunasLewatCekStatus();

      await click(getButton("Lihat Riwayat", dialog()!));

      expect(router.push).toHaveBeenCalledWith("/riwayat");
    });

    it("dirender di luar halaman agar tidak tertutup navigasi bawah", async () => {
      await lunasLewatCekStatus();

      expect(container.contains(dialog())).toBe(false);
      expect(findButton("Ke Beranda", dialog()!)).toBeDefined();
    });
  });
});
