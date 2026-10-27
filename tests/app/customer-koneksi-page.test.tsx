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

const respons: Record<string, unknown> = {
  "/api/customer/usage": {
    connection: {
      isOnline: true,
      ipAddress: "172.31.251.254",
      sessionDurationFormatted: "56m 22d",
    },
  },
  "/api/customer/profile": {
    profile: {
      paket: {
        nama: "TES-LAB2 5M",
        bandwidth: { download: "6M", upload: "4M" },
      },
    },
  },
};

vi.mock("@/lib/hooks/useApi", () => ({
  useApi: (url: string | null) => ({
    data: url ? respons[url] : undefined,
    isLoading: false,
    error: null as Error | null,
    mutate: vi.fn(),
  }),
}));

import CustomerConnectionPage from "@/app/(customer)/koneksi/page";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("halaman Status Koneksi pelanggan", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("menampilkan kecepatan paket dari rate limit, bukan angka contoh", () => {
    act(() => root.render(<CustomerConnectionPage />));
    const teks = container.textContent ?? "";

    expect(teks).toContain("Kecepatan paket");
    expect(teks).toContain("6M");
    expect(teks).toContain("4M");
    expect(teks).not.toContain("150");
  });

  it("tidak menampilkan ping karena tidak ada pengukurannya", () => {
    act(() => root.render(<CustomerConnectionPage />));
    expect(container.textContent).not.toContain("Ping");
  });
});
