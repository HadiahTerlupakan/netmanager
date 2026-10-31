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
  router,
  tagihanApi,
} from "../fixtures/tagihan-page";
import {
  click,
  flushPromises,
  getButton,
  jsonResponse,
  pressKey,
  typeInto,
} from "../helpers/portal-dom";

function dialog() {
  return document.querySelector<HTMLElement>('[role="dialog"]');
}

function radios() {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
  );
}

describe("halaman tagihan pelanggan: pilih metode pembayaran", () => {
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

  async function bukaDialog() {
    await render();
    const bayar = getButton("Bayar Sekarang");
    bayar.focus();
    await click(bayar);
    return bayar;
  }

  beforeEach(() => {
    resetTagihanApi();
    tagihanApi.invoices = [buatInvoice()];
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) =>
      url === "/api/customer/coupons/verify"
        ? jsonResponse({
            success: true,
            data: { valid: true, code: "HEMAT10", discountAmount: 10000 },
          })
        : jsonResponse({ success: true, data: { paymentUrl: null } }),
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

  // Metode pertama dulu terpilih diam-diam, jadi pelanggan bisa membayar
  // lewat BCA VA tanpa pernah memilihnya.
  it("tidak ada metode yang terpilih sebelum pelanggan memilih", async () => {
    await bukaDialog();

    expect(radios().some((radio) => radio.checked)).toBe(false);
    expect(getButton("Konfirmasi & Bayar").disabled).toBe(true);

    await click(radios().find((radio) => radio.value === "BR")!);
    expect(getButton("Konfirmasi & Bayar").disabled).toBe(false);
    await click(getButton("Konfirmasi & Bayar"));
    await flushPromises();

    const [, init] = fetchMock.mock.calls.find(
      ([url]) => url === "/api/customer/payments",
    )!;
    expect(JSON.parse(String(init.body)).paymentMethod).toBe("BR");
  });

  it("daftar metode adalah radiogroup berlabel yang bisa dipakai dengan papan ketik", async () => {
    await bukaDialog();

    const group = dialog()!.querySelector('[role="radiogroup"]')!;
    const labelId = group.getAttribute("aria-labelledby")!;
    expect(document.getElementById(labelId)?.textContent).toContain(
      "Metode Pembayaran",
    );
    const names = new Set(radios().map((radio) => radio.name));
    expect(names.size).toBe(1);
    expect(radios()[0].closest("label")?.textContent).toContain(
      "BCA Virtual Account",
    );
    expect(radios().every((radio) => radio.tabIndex >= 0)).toBe(true);
  });

  it("daftar metode diminta untuk nominal yang akan dibayar, setelah kupon", async () => {
    await bukaDialog();
    expect(tagihanApi.methodsUrls.at(-1)).toBe(
      "/api/customer/payment-methods?amount=100000",
    );

    const kupon = dialog()!.querySelector<HTMLInputElement>(
      'input[placeholder="Masukkan kode"]',
    )!;
    await typeInto(kupon, "hemat10");
    await click(getButton("Gunakan"));
    await flushPromises();

    expect(tagihanApi.methodsUrls.at(-1)).toBe(
      "/api/customer/payment-methods?amount=90000",
    );
  });

  describe("daftar metode tidak tersedia", () => {
    it("gagal dimuat: ada tombol coba lagi", async () => {
      tagihanApi.methodsError = new Error("Gagal memuat metode pembayaran");
      await bukaDialog();

      expect(dialog()!.textContent).toContain(
        "Gagal memuat metode pembayaran. Coba lagi.",
      );
      await click(getButton("Coba Lagi", dialog()!));
      expect(tagihanApi.refetchMethods).toHaveBeenCalled();
    });

    it("memang kosong: tidak menyuruh mencoba lagi", async () => {
      tagihanApi.methods = [];
      await bukaDialog();

      expect(dialog()!.textContent).toContain(
        "Tidak ada metode pembayaran tersedia",
      );
      expect(dialog()!.textContent).not.toContain("Coba Lagi");
    });
  });

  describe("dialog bayar", () => {
    it("bernama, modal, dan fokusnya berada di dalam dialog", async () => {
      await bukaDialog();

      const element = dialog()!;
      expect(element.getAttribute("aria-modal")).toBe("true");
      const titleId = element.getAttribute("aria-labelledby")!;
      expect(document.getElementById(titleId)?.textContent).toBe(
        "Rincian Pembayaran",
      );
      expect(element.contains(document.activeElement)).toBe(true);
    });

    it("Escape menutupnya dan fokus kembali ke Bayar Sekarang", async () => {
      const bayar = await bukaDialog();

      await pressKey("Escape");

      expect(dialog()).toBeNull();
      expect(document.activeElement).toBe(bayar);
    });

    it("tombol ikon punya nama yang terbaca", async () => {
      await bukaDialog();

      expect(getButton("Tutup", dialog()!).getAttribute("aria-label")).toBe(
        "Tutup",
      );
      await click(getButton("Kembali", container));
      expect(router.back).toHaveBeenCalled();
    });
  });
});
