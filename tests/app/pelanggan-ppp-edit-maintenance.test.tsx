// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Form edit tidak punya pilihan status MAINTENANCE, sementara semua radio
 * status `required`. Untuk pelanggan MAINTENANCE tidak ada radio yang
 * tercentang, jadi validasi bawaan browser membatalkan submit di tab Paket:
 * tidak ada request, tidak ada pesan galat, dan perubahan tidak tersimpan.
 */

const palsu = vi.hoisted(() => ({
  useApi: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("@/lib/hooks/useApi", () => ({ useApi: palsu.useApi }));
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ showToast: palsu.showToast }),
}));
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "pel-1" }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
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
  status: "MAINTENANCE",
  tipe: "REGULER",
  hargaPaketId: "paket-1",
  tanggalAktif: "2026-10-01T00:00:00.000Z",
  jatuhTempo: "2026-11-01T00:00:00.000Z",
};

let container: HTMLDivElement;
let root: Root;
let fetchMock: ReturnType<typeof vi.fn>;
let statusTersimpan = "MAINTENANCE";

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  statusTersimpan = "MAINTENANCE";
  palsu.useApi.mockImplementation((url: string | null) => ({
    data: url?.startsWith("/api/hargapakets") ? [paket] : undefined,
    error: null,
    isLoading: false,
  }));
  fetchMock = vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          success: true,
          data: { ...pelanggan, status: statusTersimpan },
        }),
      ),
  );
  vi.stubGlobal("fetch", fetchMock);
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

function putRequests() {
  return fetchMock.mock.calls.filter(
    ([, init]) => (init as RequestInit | undefined)?.method === "PUT",
  );
}

async function simpanForm() {
  await act(async () => root.render(<PppClientEditForm />));
  await settle();
  const submit = container.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  )!;
  await act(async () => submit.click());
  await settle();
}

describe("form edit pelanggan PPP berstatus MAINTENANCE", () => {
  it("pembanding: pelanggan AKTIF tersimpan dengan statusnya", async () => {
    statusTersimpan = "AKTIF";
    await simpanForm();

    expect(putRequests()).toHaveLength(1);
    expect((putRequests()[0][1]!.body as FormData).get("status")).toBe(
      "AKTIF",
    );
  });

  it("menampilkan status MAINTENANCE sebagai pilihan yang tercentang", async () => {
    await act(async () => root.render(<PppClientEditForm />));
    await settle();

    const radio = container.querySelector<HTMLInputElement>(
      'input[name="status"][value="MAINTENANCE"]',
    );
    expect(radio?.checked).toBe(true);
  });

  it("menyimpan perubahan tanpa memaksa admin mengganti status", async () => {
    await simpanForm();

    expect(putRequests()).toHaveLength(1);
    const body = putRequests()[0][1]!.body as FormData;
    expect(body.get("status")).toBe("MAINTENANCE");
  });
});
