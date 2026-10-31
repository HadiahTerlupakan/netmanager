// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() =>
  vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
);
vi.mock("next/navigation", () => ({ redirect }));

import PaymentReturnPage from "@/app/pembayaran/kembali/page";
import { ReturnToAppNotice } from "@/app/pembayaran/kembali/ReturnToAppNotice";
import "../helpers/portal-dom";

const APP_DEEP_LINK = "netmanager://tagihan";

/**
 * Pembayaran dari aplikasi dibuka di browser; gateway lalu kembali ke
 * returnUrl portal. Halaman ini harus terbuka tanpa sesi portal (browser itu
 * tidak punya cookie pelanggan) dan mengembalikan pelanggan ke aplikasi.
 */
describe("/pembayaran/kembali", () => {
  beforeEach(() => {
    redirect.mockClear();
  });

  it("tanpa ?ke=app dialihkan ke /tagihan", async () => {
    await expect(
      PaymentReturnPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/tagihan");
  });

  it("kode hasil gateway ikut dibawa ke /tagihan", async () => {
    await expect(
      PaymentReturnPage({
        searchParams: Promise.resolve({ resultCode: "00", reference: "R1" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/tagihan?resultCode=00");
  });

  it("dengan ?ke=app tidak dialihkan", async () => {
    const element = await PaymentReturnPage({
      searchParams: Promise.resolve({ ke: "app", resultCode: "00" }),
    });

    expect(redirect).not.toHaveBeenCalled();
    expect(element).toBeTruthy();
  });

  describe("pemberitahuan kembali ke aplikasi", () => {
    let container: HTMLDivElement;
    let root: Root;
    const openDeepLink = vi.fn();

    beforeEach(async () => {
      openDeepLink.mockClear();
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
      await act(async () =>
        root.render(<ReturnToAppNotice openDeepLink={openDeepLink} />),
      );
    });

    afterEach(async () => {
      await act(async () => root.unmount());
      container.remove();
    });

    function tautan(label: string) {
      return Array.from(container.querySelectorAll("a")).find((a) =>
        a.textContent?.includes(label),
      );
    }

    it("langsung mencoba membuka aplikasi", () => {
      expect(openDeepLink).toHaveBeenCalledWith(APP_DEEP_LINK);
    });

    it("menyediakan tombol ke aplikasi dan tautan kecil ke portal", () => {
      expect(tautan("Kembali ke aplikasi RADPRO")?.getAttribute("href")).toBe(
        APP_DEEP_LINK,
      );
      expect(tautan("Buka di portal")?.getAttribute("href")).toBe("/tagihan");
    });
  });
});
