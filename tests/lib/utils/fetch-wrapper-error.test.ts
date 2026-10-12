import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FetchError,
  fetchWithHandling,
  isFetchError,
} from "@/lib/utils/fetch-wrapper";

/**
 * Galat dari `fetchWithHandling` harus sampai ke layar apa adanya.
 *
 * Puluhan pemanggil menulis `err instanceof Error ? err.message : "Terjadi
 * kesalahan"`. Selama galat ini berupa objek literal, pemeriksaan itu selalu
 * gagal dan pesan server dibuang — persis yang terjadi di Stock Opname
 * 2026-10-12: API menjelaskan "Total kondisi ... tidak boleh melebihi stok
 * fisik", operator hanya melihat "Terjadi kesalahan".
 */
describe("FetchError", () => {
  const fetchAsli = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = fetchAsli;
    vi.restoreAllMocks();
  });

  function pasangRespons(status: number, body: unknown) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      headers: new Headers(),
      json: async () => body,
    }) as unknown as typeof fetch;
  }

  it("melempar Error sungguhan, bukan objek biasa", async () => {
    pasangRespons(400, { error: "Pesan asli dari server" });

    const galat = await fetchWithHandling("/api/apa-saja").catch((e) => e);

    expect(galat).toBeInstanceOf(Error);
    expect(galat).toBeInstanceOf(FetchError);
    expect(galat.message).toBe("Pesan asli dari server");
  });

  it("meneruskan pesan server ke pemanggil yang memeriksa instanceof Error", async () => {
    pasangRespons(400, {
      error:
        "Total kondisi (baik + rusak + expire) tidak boleh melebihi stok fisik",
    });

    // Pola yang dipakai tujuh layar di aplikasi ini.
    const pesan = await fetchWithHandling("/api/inventory/opname/batch", {
      method: "POST",
    }).catch((err) =>
      err instanceof Error ? err.message : "Terjadi kesalahan",
    );

    expect(pesan).toBe(
      "Total kondisi (baik + rusak + expire) tidak boleh melebihi stok fisik",
    );
  });

  it("tetap memenuhi penjaga tipe isFetchError beserta status dan detailnya", async () => {
    pasangRespons(422, {
      error: "Validasi gagal",
      details: { stokFisik: ["wajib diisi"] },
    });

    const galat = await fetchWithHandling("/api/apa-saja").catch((e) => e);

    expect(isFetchError(galat)).toBe(true);
    expect(galat.status).toBe(422);
    expect(galat.details).toEqual({ stokFisik: ["wajib diisi"] });
  });

  it("membawa retryAfter saat kena batas laju", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers({ "Retry-After": "30" }),
      json: async () => ({}),
    }) as unknown as typeof fetch;

    const galat = await fetchWithHandling("/api/apa-saja").catch((e) => e);

    expect(galat).toBeInstanceOf(FetchError);
    expect(galat.retryAfter).toBe(30);
    expect(galat.message).toContain("30 detik");
  });
});
