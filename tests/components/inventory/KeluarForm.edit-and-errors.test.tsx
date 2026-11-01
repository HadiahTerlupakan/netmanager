// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/client-logger", () => ({
  clientLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@/components/inventory/form-shared", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/inventory/form-shared")
  >("@/components/inventory/form-shared");

  return {
    ...actual,
    useGudangOptions: () => ({
      gudangs: [{ id: "g1", kode: "GD-1", nama: "Gudang Utama" }],
      isLoading: false,
    }),
    useBarangOptions: () => ({
      isSearching: false,
      fetchBarangs: vi.fn(),
      findBarang: () => ({
        id: "b1",
        kode: "K-01",
        nama: "Kabel Drop",
        satuan: "roll",
      }),
      buildOptions: () => [{ value: "b1", label: "K-01 - Kabel Drop" }],
    }),
    useFotoBuktiUpload: () => ({
      photoUploadRef: { current: null as unknown },
      tempId: "temp-1",
      setUploadedPhotos: vi.fn(),
      uploadPendingPhotos: vi.fn().mockResolvedValue({ urls: [], photos: [] }),
      buildFotoMetadata: (): null => null,
      resetFotoState: vi.fn(),
    }),
    useStockByCondition: () => ({
      BARU: 10,
      BEKAS: 0,
      RUSAK: 0,
      totalStok: 10,
    }),
    FotoBuktiSection: (): null => null,
  };
});

import { KeluarForm } from "@/components/inventory/KeluarForm";
import {
  InventoryRequestError,
  sendInventoryRequest,
} from "@/components/inventory/form-shared";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const EDITED_KELUAR = {
  id: "k-1",
  barangId: "b1",
  gudangId: "g1",
  jumlah: 3,
  kondisi: "BARU" as const,
  keterangan: "Instalasi",
};

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("KeluarForm mode edit", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    // jsdom tidak punya scrollIntoView.
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  async function renderAndSubmit() {
    await act(async () =>
      root.render(<KeluarForm initialData={EDITED_KELUAR} onClose={vi.fn()} />),
    );
    const form = container.querySelector("form")!;
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
  }

  it("menyimpan perubahan lewat PUT ke catatan lama, bukan mencatat barang keluar baru", async () => {
    const fetchMock = stubFetch(200, { success: true, data: null });

    await renderAndSubmit();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/inventory/keluar/k-1");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({
      jumlah: 3,
      keterangan: "Instalasi",
    });
  });

  it("menampilkan pesan server apa adanya saat perubahan ditolak", async () => {
    const pesan =
      "Jumlah Kabel Drop tidak bisa dinaikkan sebanyak itu. Stok Kabel Drop kondisi Baru di Gudang Utama tinggal 2 roll. Isi jumlah paling banyak 5.";
    stubFetch(400, { success: false, error: pesan });

    await renderAndSubmit();

    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toBe(pesan);
  });
});

describe("sendInventoryRequest", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("internet putus: pesan jelas, bukan 'Failed to fetch'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    const error = await sendInventoryRequest(
      "/api/x",
      { method: "POST", body: {} },
      "cadangan",
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(InventoryRequestError);
    expect((error as Error).message).toBe(
      "Tidak bisa terhubung ke server. Periksa internet Anda, lalu coba lagi.",
    );
  });

  it("jawaban server bukan JSON (mis. halaman 502): jangan suruh simpan ulang membabi buta", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError("Unexpected token <");
        },
      })),
    );

    const error = await sendInventoryRequest(
      "/api/x",
      { method: "POST", body: {} },
      "cadangan",
    ).catch((e: unknown) => e);

    expect((error as Error).message).toContain("Periksa daftarnya dulu");
  });

  it("sesi habis tanpa pesan server: suruh login lagi", async () => {
    stubFetch(401, {});

    const error = await sendInventoryRequest(
      "/api/x",
      { method: "DELETE" },
      "cadangan",
    ).catch((e: unknown) => e);

    expect((error as Error).message).toBe(
      "Sesi login Anda sudah habis. Silakan login lagi, lalu ulangi.",
    );
  });
});
