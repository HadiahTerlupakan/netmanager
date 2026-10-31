// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "Batalkan & Buat Tagihan Baru" tidak membatalkan tagihan yang sedang
 * dibayar pelanggan. Form dulu mengabaikan isi respons simpan dan langsung
 * kembali ke daftar, jadi admin tidak pernah tahu tagihannya tidak diganti.
 */

const palsu = vi.hoisted(() => ({
  useApi: vi.fn(),
  showToast: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/lib/hooks/useApi", () => ({ useApi: palsu.useApi }));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ showToast: palsu.showToast }),
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "pel-1" }),
  useRouter: () => ({ push: palsu.push, refresh: vi.fn() }),
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

const PESAN =
  "Tagihan INV/2026/10/28-AAA tidak dibatalkan karena pelanggan sedang membayar (BCA Virtual Account aktif sampai 1 Nov 2026, 10.00 WIB). Tagihan baru tidak dibuat; ulangi setelah pembayarannya selesai atau kedaluwarsa.";

const pelanggan = {
  id: "pel-1",
  idPelanggan: "10000001",
  nama: "Budi",
  username: "budi",
  status: "AKTIF",
  tipe: "REGULER",
  hargaPaketId: "paket-1",
  tanggalAktif: "2026-10-24T00:00:00.000Z",
  jatuhTempo: "2026-11-23T00:00:00.000Z",
};

let container: HTMLDivElement;
let root: Root;

function respondToSave(data: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? new Response(JSON.stringify({ success: true, data }))
        : new Response(JSON.stringify({ data: pelanggan })),
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  palsu.useApi.mockImplementation((url: string | null) => ({
    data: url?.startsWith("/api/hargapakets")
      ? [
          {
            id: "paket-1",
            name: "20 Mbps",
            harga: 150000,
            durasi: 30,
            durasiUnit: "HARI",
            status: "AKTIF",
          },
        ]
      : undefined,
    error: null,
    isLoading: false,
  }));
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

async function renderAndSave() {
  await act(async () => root.render(<PppClientEditForm />));
  await settle();
  await act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await settle();
}

describe("form edit pelanggan PPP — tindakan tagihan", () => {
  it("menampilkan alasan tagihan tidak diganti dan tetap di halaman", async () => {
    respondToSave({ ...pelanggan, invoiceActionMessage: PESAN });

    await renderAndSave();

    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      PESAN,
    );
    expect(palsu.showToast).toHaveBeenCalledWith("warning", PESAN, 15000);
    expect(palsu.push).not.toHaveBeenCalled();
  });

  it("kembali ke daftar bila tagihan diganti seperti diminta", async () => {
    respondToSave(pelanggan);

    await renderAndSave();

    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(palsu.showToast).toHaveBeenCalledWith(
      "success",
      "Data pelanggan berhasil diperbarui",
    );
    expect(palsu.push).toHaveBeenCalledWith("/admin/pelanggan/ppp");
  });
});
