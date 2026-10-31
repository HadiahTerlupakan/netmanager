// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/dashboard" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
}));

import BottomNav from "@/components/customer/BottomNav";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * /riwayat dulu memasang navigasi bawahnya sendiri (Beranda/Paket/Riwayat/
 * Akun) di atas navigasi portal. Sekarang ia memakai navigasi bersama, dan
 * karena dibuka dari /tagihan, tab Tagihan-lah yang aktif di sana.
 */
describe("navigasi bawah portal pelanggan", () => {
  let root: Root;
  let container: HTMLDivElement;

  async function renderAt(pathname: string) {
    navigation.pathname = pathname;
    await act(async () => root.render(<BottomNav />));
  }

  function activeTabs() {
    return Array.from(container.querySelectorAll('a[aria-current="page"]')).map(
      (link) => link.textContent,
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

  it("menandai tab halaman yang sedang dibuka", async () => {
    await renderAt("/tagihan");
    expect(activeTabs()).toEqual(["Tagihan"]);

    await renderAt("/paket");
    expect(activeTabs()).toEqual(["Paket"]);
  });

  it("menandai Tagihan sebagai tab aktif di /riwayat", async () => {
    await renderAt("/riwayat");
    expect(activeTabs()).toEqual(["Tagihan"]);
  });

  it("riwayat tiket dukungan tidak ikut mengaktifkan tab Tagihan", async () => {
    await renderAt("/dukungan/riwayat");
    expect(activeTabs()).toEqual([]);
  });
});
