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

const profilTesLab = {
  nama: "TES LAB 02",
  idPelanggan: "PLG-0002",
  status: "AKTIF",
  alamat: "Lab",
  tanggalAktif: "2025-01-10T00:00:00.000+07:00",
  jatuhTempo: "2026-11-23T00:00:00.000+07:00",
  paket: {
    nama: "TES-LAB2 5M",
    harga: 0,
    bandwidth: { download: "6M", upload: "4M" },
  },
};

const respons: Record<string, unknown> = {};

vi.mock("@/lib/hooks/useApi", () => ({
  useApi: (url: string | null) => ({
    data: url ? respons[url] : undefined,
    isLoading: false,
    error: null as Error | null,
    mutate: vi.fn(),
  }),
}));

import CustomerPaketPage from "@/app/(customer)/paket/page";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function opsiUpgrade(id: string, nama: string, selisih: number) {
  return {
    id,
    nama,
    harga: selisih,
    durasi: 1,
    durasiUnit: "BULAN",
    isFeatured: false,
    priceDifference: selisih,
    bandwidth: null as null,
  };
}

describe("halaman Detail Layanan pelanggan", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    respons["/api/customer/profile"] = { profile: profilTesLab };
    respons["/api/customer/usage"] = {
      connection: { isOnline: true, ipAddress: "172.31.251.254/32" },
    };
    respons["/api/customer/package"] = { upgradeOptions: [] };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function render() {
    act(() => root.render(<CustomerPaketPage />));
    return container.textContent ?? "";
  }

  it("menampilkan bulan awal periode tagihan, bukan hanya tanggalnya", () => {
    expect(render()).toContain("23 Okt - 23 Nov 2026");
  });

  it("tidak mengklaim kuota yang tidak ada di data paket", () => {
    expect(render()).not.toContain("Unlimited Fiber");
  });

  it("menampilkan IP sesi aktif beserta jenisnya, bukan teks tetap", () => {
    const teks = render();
    expect(teks).toContain("172.31.251.254 (Privat)");
    expect(teks).not.toContain("Dynamic Public");
  });

  it("menyembunyikan baris IP saat pelanggan offline", () => {
    respons["/api/customer/usage"] = {
      connection: { isOnline: false, ipAddress: null },
    };
    expect(render()).not.toContain("Jenis IP Address");
  });

  it("tidak menawarkan upgrade saat tidak ada paket kandidat", () => {
    const teks = render();
    expect(teks).not.toContain("Rekomendasi untukmu");
    expect(teks).not.toContain("200 Mbps");
  });

  it("menawarkan kandidat upgrade termurah dengan selisih harganya", () => {
    respons["/api/customer/package"] = {
      upgradeOptions: [
        opsiUpgrade("b", "Home 50M", 100000),
        opsiUpgrade("a", "Home 20M", 50000),
      ],
    };
    const teks = render();
    expect(teks).toContain("Upgrade ke Home 20M?");
    expect(teks).toContain("Tambah Rp 50.000/bln");
  });
});
