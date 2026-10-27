// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Form edit dulu menghitung ulang jatuh tempo dari tanggal aktif + durasi
 * paket begitu data dimuat, jadi pelanggan yang sudah diperpanjang mundur
 * jatuh temponya cukup dengan membuka lalu menyimpan form.
 */

const palsu = vi.hoisted(() => ({
  useApi: vi.fn(),
  showToast: vi.fn(),
  paketSiap: false,
}));

vi.mock("@/lib/hooks/useApi", () => ({ useApi: palsu.useApi }));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ showToast: palsu.showToast }),
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "pel-1" }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { PppClientEditForm } from "@/app/admin/pelanggan/ppp/[id]/edit/PppEditClient";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const paket = {
  id: "paket-1",
  name: "20 Mbps",
  harga: 150000,
  durasi: 30,
  durasiUnit: "HARI",
  status: "AKTIF",
};

const pelanggan = {
  id: "pel-1",
  idPelanggan: "10000001",
  nama: "Budi",
  username: "budi",
  status: "AKTIF",
  tipe: "REGULER",
  hargaPaketId: "paket-1",
  tanggalAktif: "2026-10-24T00:00:00.000Z",
  // Sudah diperpanjang: jauh setelah tanggal aktif + 1 bulan.
  jatuhTempo: "2027-01-23T00:00:00.000Z",
};

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  palsu.paketSiap = false;
  palsu.useApi.mockImplementation((url: string | null) => ({
    data:
      palsu.paketSiap && url?.startsWith("/api/hargapakets")
        ? [paket]
        : undefined,
    error: null,
    isLoading: false,
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ data: pelanggan }))),
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function settle() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

function dueDateInput() {
  return container.querySelector<HTMLInputElement>('input[name="jatuhTempo"]');
}

describe("form edit pelanggan PPP", () => {
  // Di produksi daftar paket (SWR) tiba setelah data pelanggan.
  it("mempertahankan jatuh tempo tersimpan saat data dimuat", async () => {
    await act(async () => root.render(<PppClientEditForm />));
    await settle();
    palsu.paketSiap = true;
    await act(async () => root.render(<PppClientEditForm />));
    await settle();

    expect(dueDateInput()?.value).toBe("2027-01-23");
  });

  it("menghitung ulang jatuh tempo setelah tanggal aktif diubah", async () => {
    palsu.paketSiap = true;
    await act(async () => root.render(<PppClientEditForm />));
    await settle();

    const tanggalAktif = container.querySelector<HTMLInputElement>(
      'input[name="tanggalAktif"]',
    )!;
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    await act(async () => {
      setValue.call(tanggalAktif, "2026-12-01");
      tanggalAktif.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await settle();

    expect(dueDateInput()?.value).toBe("2026-12-31");
  });
});
