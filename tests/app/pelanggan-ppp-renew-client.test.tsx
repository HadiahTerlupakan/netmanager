// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Halaman perpanjangan admin dulu memanggil endpoint yang sudah dihapus
 * (`/api/tagihan/{id}/bayar`, PUT JSON ke `/api/pelanggan-ppp/{id}`) dan
 * membaca daftar tagihan sebagai array padahal route mengembalikan
 * `{ data: [...] }`, sehingga tagihan terbuka tidak pernah terlihat.
 */

const palsu = vi.hoisted(() => ({
  useApi: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/lib/hooks/useApi", () => ({ useApi: palsu.useApi }));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "pel-1" }),
  useRouter: () => ({ push: palsu.push }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { PppClientRenewForm } from "@/app/admin/pelanggan/ppp/[id]/renew/PppRenewClient";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const HARI_MS = 24 * 60 * 60 * 1000;
const URL_PELANGGAN = "/api/pelanggan-ppp/pel-1";
const URL_TAGIHAN = "/api/tagihan/pelanggan/pel-1";
const URL_RENEW = "/api/pelanggan-ppp/pel-1/renew";

/** Hasil `useApi` palsu; dianotasi eksplisit karena TS7018. */
type HasilApiPalsu = {
  data: unknown;
  error: { message: string } | null;
  isLoading: boolean;
};

const pelanggan = {
  id: "pel-1",
  idPelanggan: "10000001",
  nama: "Budi",
  tipe: "REGULER",
  status: "ISOLIR",
  hargaPaketId: "paket-1",
  hargaPaket: { id: "paket-1", name: "20 Mbps", harga: 150000 },
  // Dalam jendela perpanjangan (default 5 hari sebelum jatuh tempo).
  jatuhTempo: new Date(Date.now() + 2 * HARI_MS).toISOString(),
};

const tagihanTerbuka = {
  id: "inv-1",
  noTagihan: "INV/2026/10/27-ABC",
  total: 166500,
  ppn: 16500,
  status: "BELUM_LUNAS",
  jatuhTempo: pelanggan.jatuhTempo,
};

let container: HTMLDivElement;
let root: Root;
let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  mockFetch = vi.fn();
  vi.stubGlobal("fetch", mockFetch);
  palsu.useApi.mockImplementation((key: string | null): HasilApiPalsu => {
    if (key === URL_PELANGGAN) {
      return { data: pelanggan, error: null, isLoading: false };
    }
    if (key === URL_TAGIHAN) {
      return {
        data: { data: [tagihanTerbuka] },
        error: null,
        isLoading: false,
      };
    }
    return { data: undefined, error: null, isLoading: false };
  });
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

async function renderHalaman() {
  await act(async () => {
    root.render(<PppClientRenewForm />);
  });
}

async function pilih(selektor: string, nilai: string) {
  const elemen = document.querySelector<HTMLSelectElement>(selektor);
  expect(elemen).not.toBeNull();
  await act(async () => {
    elemen!.value = nilai;
    elemen!.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function kirim() {
  const tombol = document.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  );
  expect(tombol).not.toBeNull();
  await act(async () => {
    tombol!.click();
  });
  for (let putaran = 0; putaran < 3; putaran += 1) {
    await act(async () => {
      await new Promise((selesai) => setTimeout(selesai, 0));
    });
  }
}

describe("PppClientRenewForm", () => {
  it("menampilkan tagihan terbuka dari respons { data: [...] }", async () => {
    await renderHalaman();

    expect(document.body.textContent).toContain("BELUM BAYAR");
    expect(document.body.textContent).toContain("Batalkan Tagihan");
  });

  it("mengirim perpanjangan ke /renew dengan metode yang dipetakan ke enum pembayaran", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          invoiceId: "inv-1",
          invoiceStatus: "PAID",
          expectedJatuhTempo: "2026-12-05T12:00:00.000Z",
        },
      }),
    });
    await renderHalaman();
    await pilih("#renew-metode", "OVO");

    await kirim();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(URL_RENEW);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      statusBayar: "LUNAS",
      paymentMethod: "E_WALLET",
      reference: "OVO",
    });
    expect(document.body.textContent).toContain("5 Desember 2026");
    expect(document.body.textContent).toContain("otomatis");
  });
});
